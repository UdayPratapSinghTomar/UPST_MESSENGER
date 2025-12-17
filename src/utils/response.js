const HttpsStatus = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
} 

function sendResponse(res, statusCode, status, message, data=null, errors = null){
    return res.status(statusCode).json({
        status,
        message,
        data,
        errors
    });
}

module.exports = {
    sendResponse,
    HttpsStatus
}