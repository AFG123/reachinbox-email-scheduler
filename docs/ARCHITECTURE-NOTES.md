# Architecture Notes & Known Limitations

This document lists the architectural trade-offs, engineering decisions, and known limitations intentionally accepted in the current design of the ReachInbox email scheduler.

---

## 1. PostgreSQL → BullMQ Consistency

### The Problem
During campaign scheduling, database writes and BullMQ enqueuing are executed sequentially:
1. PostgreSQL writes the campaign and email rows inside a transaction and commits.
2. If the transaction succeeds, the server loops and adds the corresponding jobs to BullMQ (Redis).

If the Redis connection drops, the Redis server crashes, or the Node process exits *immediately* after the PostgreSQL transaction commits but before the BullMQ calls complete:
* The email records will remain in the `PENDING` state in PostgreSQL forever.
* No corresponding BullMQ job will exist, so the emails will never be processed or sent.

### Production Solution
**Transactional Outbox Pattern**:
* Rather than scheduling the BullMQ job immediately in the HTTP thread, the database write records an "outbox message" in the same PostgreSQL transaction.
* A separate, dedicated publisher process polls the outbox table, enqueues the job in Redis/BullMQ, and marks the outbox message as sent once BullMQ acknowledges it. This guarantees at-least-once job delivery from PostgreSQL to Redis.

### Project Context
For the current demonstration, the sequential write was kept to prioritize architectural simplicity and highlight asynchronous processing without adding outbox pollers.

---

## 2. Fixed Hourly Rate Limiting

### The Problem
The current rate-limiting implementation uses a fixed hourly counter bucket:
```typescript
const currentHourStr = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
const rateLimitKey = `rate_limit:sender:${senderId}:${currentHourStr}`;
```
This is a **fixed-window** rate limiter. It does not calculate a true sliding window. For example:
* If the limit is 100 emails per hour, a user could send 100 emails at `12:59` and another 100 emails at `13:00`.
* Over a 2-minute period, the user has sent 200 emails, violating the spirit of a true 100-email-per-hour limit.

### Production Solution
**Redis Sliding Window Rate Limiter**:
* Use a Redis Sorted Set (`ZSET`) for each sender.
* Every time a send is attempted, add a member with the current timestamp to the `ZSET` and remove elements older than `current_time - 1 hour`.
* If the remaining card (`ZCARD`) of the set exceeds the hourly limit, the send is throttled.

### Project Context
The fixed-window hourly bucket was kept because it is lightweight, requires only a simple Redis `INCR` operation, and successfully spaces out traffic under standard test scenarios.

---

## 3. Worker Throttling

### The Problem
To space out consecutive emails from the same sender, the worker calculates the minimum delay and blocks execution using a sleep timer:
```typescript
const sleepDuration = targetSendTime - Date.now();
if (sleepDuration > 0) {
  await sleep(sleepDuration);
}
```
If a worker concurrency slot is sleeping, it occupies a thread slot without doing active work. With a low concurrency pool, multiple sleeping workers can temporarily block other active queue jobs from running, lowering the overall throughput.

### Production Solution
**Job Rescheduling**:
* Instead of sleeping inside the worker, if the spacing target is in the future, the worker should update the database back to `PENDING`, reschedule the job in BullMQ as a delayed job, and return immediately. This frees up the worker slot.

### Project Context
The sleep mechanism was preserved because it is highly reliable for low concurrency rates and maintains sequential campaign execution ordering.

---

## 4. SMTP Exactly-Once Delivery

### The Problem
Exactly-once delivery cannot be guaranteed under crash scenarios when communicating with third-party SMTP servers:
1. The worker connects to `smtp.ethereal.email` and successfully transmits the message.
2. The SMTP server accepts the email and sends back an confirmation ID.
3. The network socket drops or the worker process crashes *before* the worker can write the status `SENT` back to PostgreSQL.
4. On reboot, BullMQ sees the job failed/stalled and retries it.
5. The restarted worker processes the email again, resulting in a duplicate send to the recipient.

### Production Solution
* Standard SMTP protocols do not support distributed transactional agreements (two-phase commit).
* To mitigate duplicates, make use of unique message identifiers in email headers (`Message-ID`) and configure downstream mail client grouping, or implement tighter timeouts.

---

## 5. Session Storage

### The Problem
Express-Session currently defaults to in-memory storage (`MemoryStore`). If the backend server restarts (e.g. during a Render deployment), all active users are logged out because session cookies are cleared.

### Production Solution
Configure `connect-redis` or `connect-valkey` to store active session identifiers in Redis, sharing the session pool across multiple server nodes.

---

## 6. Automated Testing

### Current Coverage
* Verification scripts check happy-path campaign creation, basic rate limiting, and environment checking.

### Production Path
* Implement Mock SMTP server assertions (using `Maildev` or a local SMTP capture library).
* Add regression unit testing using Jest/Vitest for the controllers.
* Configure database seeding and cleanup automation on test runs.

---

## 7. Observability

### Production Path
* **Structured Logging**: Output logs in JSON format for indexing (e.g., using `winston` or `pino`).
* **Correlation IDs**: Pass a `X-Request-ID` header through frontend-backend-worker loops to trace logs for specific user actions.
* **Queue Monitoring**: Connect a dashboard tool like **Bull-Board** to visually monitor active, delayed, and failed jobs in real time.
