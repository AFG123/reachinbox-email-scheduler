import { Router } from 'express';
import { scheduleEmails, getScheduledEmails, getSentEmails, getSenders } from '../controllers/emailController';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

router.use(isAuthenticated);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/senders', getSenders);

export default router;
