import fs from 'fs';
import path from 'path';

const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

const combinedLogPath = path.join(logDirectory, 'combined.log');
const errorLogPath = path.join(logDirectory, 'error.log');

/**
 * Helper to write a log message to the console and log files
 */
function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
  const logMessage = `[${timestamp}] [${level}] ${message}${metaString}\n`;

  // 1. Log to Console with ANSI colors
  if (level === 'ERROR') {
    console.error(`\x1b[31m${logMessage.trim()}\x1b[0m`); // Red
    fs.appendFileSync(errorLogPath, logMessage);
  } else if (level === 'WARN') {
    console.warn(`\x1b[33m${logMessage.trim()}\x1b[0m`); // Yellow
  } else {
    console.log(logMessage.trim()); // Standard
  }

  // 2. Append to combined log file
  fs.appendFileSync(combinedLogPath, logMessage);
}

export const logger = {
  info: (message: string, meta?: any) => writeLog('INFO', message, meta),
  warn: (message: string, meta?: any) => writeLog('WARN', message, meta),
  error: (message: string, meta?: any) => writeLog('ERROR', message, meta),
};
