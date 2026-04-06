import winston from 'winston';
import { Environment } from '../config/environment';

const formatMetadata = (meta: any) => {
  const splat = meta[Symbol.for('splat')];
  if (splat && splat.length) {
    return splat.length === 1 ? JSON.stringify(splat[0]) : JSON.stringify(splat);
  }
  return '';
};

const customFormat = winston.format.printf(
  ({ timestamp, level, message, label = '', ...meta }: any) => {
    if (typeof message !== 'string') {
      console.log(`${timestamp} ${level}\t ${label}`);
    }
    return `[${timestamp}] ${level}\t ${label} ${message} ${formatMetadata(meta)}`;
  }
);

const Logger = winston.createLogger({
  level: Environment.logger.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'DD-YY-MM HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize()
  ),
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(customFormat)
    })
  ]
});

export default Logger;
