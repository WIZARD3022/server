import discordLogger
    from "../services/discord/discord.logger.js";


const errorMiddleware = (
    err,
    req,
    res,
    next
) => {

    const statusCode =
        err.statusCode ||
        err.status ||
        500;

    const durationMs =
        req.requestStartTime
            ? Date.now() -
              req.requestStartTime
            : undefined;


    /*
     * Send error to Discord.
     * Don't let Discord delay
     * the API response.
     */

    discordLogger
        .error({
            statusCode,

            method:
                req.method,

            route:
                req.originalUrl,

            code:
                err.code ||
                err.name ||
                "UNKNOWN",

            message:
                err.message ||
                "Internal Server Error",

            durationMs,

            userId:
                req.user?._id,

            ip:
                req.clientIp,

            requestId:
                req.requestId,
        })
        .catch(() => {});


    return res
        .status(statusCode)
        .json({
            success: false,

            message:
                err.message ||
                "Internal Server Error",

            requestId:
                req.requestId,
        });
};


export default errorMiddleware;