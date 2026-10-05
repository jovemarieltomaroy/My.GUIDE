const express = require(
    "express"
);
const cors = require(
    "cors"
);
const cookieParser = require(
    "cookie-parser"
);
const path = require(
    "path"
);
require(
    "dotenv"
).config();


const connectDB = require(
    "./config/db.js"
);


const authRoutes = require(
    "./routes/authRoutes.js"
);

const userRoutes = require(
    "./routes/userRoutes.js"
);

const caseRoutes = require(
    "./routes/caseRoutes.js"
);

const studentRoutes = require(
    "./routes/studentRoutes.js"
);

const preCounselingRoutes = require(
    './routes/preCounselingRoutes'
);

const knowledgeBaseRoutes = require(
    "./routes/knowledgeBaseRoutes.js"
);


const errorHandler = require(
    "./middleware/errorHandler.js"
);


const app = express();



app.use(
    cors({
        origin:
            "http://localhost:5174",

        credentials:
            true,
    })
);


app.use(
    express.json()
);

app.use(
    cookieParser()
);



app.get(
    "/",
    (
        req,
        res
    ) => {
        res.json({
            message:
                "Welcome to the backend API!",

            status:
                "Server is running smoothly",

            timestamp:
                new Date(),
        });
    }
);


/*
 * ---------------------------------------------
 * API ROUTES
 * ---------------------------------------------
 */

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/cases",
    caseRoutes
);

app.use(
    "/api/students",
    studentRoutes
);

app.use(
    '/api/pre-counseling',
    preCounselingRoutes
);

app.use(
    "/api/knowledge-base",
    knowledgeBaseRoutes
);



app.use(
    "/uploads",

    express.static(
        path.join(
            process.cwd(),
            "uploads"
        )
    )
);

app.use(
    errorHandler
);

const PORT =
    process.env.PORT ||
    5000;


const startServer =
    async () => {
        try {
            await connectDB();


            app.listen(
                PORT,
                () => {
                    console.log(
                        `Server is running on port ${PORT}`
                    );
                }
            );
        } catch (error) {
            console.error(
                "Failed to start server:",
                error.message
            );

            process.exit(
                1
            );
        }
    };


startServer();