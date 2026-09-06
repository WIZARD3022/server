import crypto from "crypto";

const getClientIp = (req) => {
    return (
        req.ip ||
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        "unknown"
    );
};

const requestLogger = (req, res, next) => {

    req.requestId = crypto.randomUUID();

    req.requestStartTime = Date.now();

    req.clientIp = getClientIp(req);

    res.setHeader(
        "X-Request-ID",
        req.requestId
    );

    next();
};

export default requestLogger;