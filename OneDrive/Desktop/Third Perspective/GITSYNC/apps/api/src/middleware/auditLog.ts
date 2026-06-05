import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AuthRequest } from './auth';

export const auditLog = (action: string, resource: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.json.bind(res);

    res.json = function (body: unknown) {
      // Log after response is sent
      const logEntry = {
        userId: req.userId || null,
        action,
        resource,
        resourceId: req.params?.id || null,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          body: typeof body === 'object' && body !== null && 'success' in body
            ? { success: (body as Record<string, unknown>).success }
            : undefined
        },
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      // Fire and forget — don't block the response
      query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [logEntry.userId, logEntry.action, logEntry.resource, logEntry.resourceId,
         JSON.stringify(logEntry.details), logEntry.ipAddress, logEntry.userAgent]
      ).catch(err => console.error('Audit log error:', err));

      return originalSend(body);
    };

    next();
  };
};
