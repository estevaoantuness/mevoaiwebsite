const errorHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    // Supabase errors
    if (err.code) {
        // PostgreSQL error codes
        if (err.code === '23505') {
            return res.status(409).json({
                ok: false,
                error: 'Duplicate entry',
                message: 'A record with this information already exists',
            });
        }

        if (err.code === '23503') {
            return res.status(400).json({
                ok: false,
                error: 'Foreign key violation',
                message: 'Referenced record does not exist',
            });
        }

        if (err.code === 'PGRST116') {
            return res.status(404).json({
                ok: false,
                error: 'Not found',
                message: 'The requested resource was not found',
            });
        }
    }

    // Axios errors (Evolution API)
    if (err.isAxiosError) {
        return res.status(err.response?.status || 500).json({
            ok: false,
            error: 'External API error',
            message: err.response?.data?.message || err.message,
        });
    }

    // Default error
    res.status(err.status || 500).json({
        ok: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    asyncHandler,
};
