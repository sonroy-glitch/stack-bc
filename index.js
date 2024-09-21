"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const node_cron_1 = __importDefault(require("node-cron"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.AI_URL);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const currentDate = new Date();
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const jwtSecret = "sr1435";
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "mediumblog10@gmail.com",
        pass: process.env.MAIL_URL,
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(1),
});
const signinSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
const postSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().min(10),
    tags: zod_1.z.string(),
});
app.post("/auth/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var body = req.body;
    var check = signupSchema.safeParse(body);
    if (!check.success) {
        return res.status(202).send("Wrong format of the email or password");
    }
    var user = yield prisma.user.findFirst({
        where: { email: body.email },
    });
    if (user != null) {
        return res.status(202).send("User already exists, signin");
    }
    var hashedPassword = yield bcryptjs_1.default.hash(body.password, 10);
    var data = yield prisma.user.create({
        data: {
            name: body.name,
            email: body.email,
            password: hashedPassword,
            time: currentDate.getTime() / 100,
        },
    });
    if (data != null) {
        var token = jsonwebtoken_1.default.sign({ name: body.name }, jwtSecret);
        return res.status(200).send(token + "+" + data.name[0].toUpperCase());
    }
}));
app.post("/auth/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var body = req.body;
    var check = signinSchema.safeParse(body);
    if (!check.success) {
        return res.status(202).send("Wrong format of the email or password");
    }
    var user = yield prisma.user.findFirst({
        where: { email: body.email },
    });
    if (user == null) {
        return res.status(202).send("User doesnt exists, signup");
    }
    else if (user != null) {
        var check1 = yield bcryptjs_1.default.compare(body.password, user.password);
        if (!check1) {
            return res.status(202).send("Wrong password");
        }
        var token = jsonwebtoken_1.default.sign({ name: user.name }, jwtSecret);
        return res.status(200).send(token + "+" + user.name[0].toUpperCase());
    }
}));
app.use("/api/*", (req, res, next) => {
    var token = String(req.headers.auth);
    var check = jsonwebtoken_1.default.verify(token, jwtSecret, (err) => {
        if (err) {
            return res.status(202).send("Invalid token");
        }
        next();
    });
});
app.post("/api/question", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var token = String(req.headers.auth);
    var body = req.body;
    var verify = jsonwebtoken_1.default.decode(token);
    if (verify !== null && typeof verify === "object") {
        var data = yield prisma.user.findFirst({
            where: { name: verify.name },
        });
        if (data != null) {
            if (data.leftQuestions > 0) {
                var question = yield prisma.question.create({
                    data: {
                        user_id: data.id,
                        name: data.name,
                        title: body.title,
                        description: body.description,
                        tags: body.tags,
                        time: currentDate.getTime() / 100,
                    },
                });
                var points = Number(data.points) + 5;
                var update = yield prisma.user.update({
                    where: { name: verify.name },
                    data: { leftQuestions: Number(data.leftQuestions - 1),
                        points
                    }
                });
                return res.status(200).json(question);
            }
            else {
                return res.status(202).send("Out of questions limit");
            }
        }
    }
}));
app.post("/api/answer", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var token = String(req.headers.auth);
    var body = req.body;
    var verify = jsonwebtoken_1.default.decode(token);
    if (verify !== null && typeof verify === "object") {
        var data = yield prisma.user.findFirst({
            where: { name: verify.name },
        });
        if (data != null) {
            var question = yield prisma.answer.create({
                data: {
                    user_id: data.id,
                    name: data.name,
                    question_id: body.id,
                    answer: body.answer,
                    time: currentDate.getTime() / 100,
                },
            });
            var send = yield prisma.question.findFirst({
                where: { id: body.id },
                select: {
                    id: true,
                    user_id: true,
                    title: true,
                    name: true,
                    description: true,
                    answer: true,
                    upvote: true,
                    downvote: true,
                    tags: true,
                    time: true,
                },
            });
            var points = Number(data.points) + 5;
            var update = yield prisma.user.update({
                where: { name: verify.name },
                data: {
                    points
                }
            });
            return res.status(200).json(send);
        }
    }
}));
app.get("/send/all", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var data = yield prisma.question.findMany({
        select: {
            id: true,
            user_id: true,
            title: true,
            name: true,
            description: true,
            answer: true,
            upvote: true,
            downvote: true,
            tags: true,
            time: true,
        },
    });
    return res.status(200).json(data);
}));
app.get("/send/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var id = Number(req.params.id);
    var data = yield prisma.question.findFirst({
        where: { id },
        select: {
            id: true,
            user_id: true,
            title: true,
            name: true,
            description: true,
            answer: true,
            upvote: true,
            downvote: true,
            tags: true,
            time: true,
        },
    });
    return res.status(200).json(data);
}));
app.put("/api/question", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var question_id = Number(req.headers.question_id);
    var data = req.body;
    var question = yield prisma.question.update({
        where: { id: question_id },
        data: {
            title: data.title,
            description: data.description,
        },
    });
    return res.status(200).send("question updated successfully");
}));
app.put("/api/answer", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var answer_id = Number(req.headers.answer_id);
    var data = req.body;
    var answer = yield prisma.answer.update({
        where: { id: answer_id },
        data: {
            answer: data.answer,
        },
    });
    return res.status(200).send("question updated successfully");
}));
app.get("/api/delete/answer", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var answer_id = Number(req.headers.answer_id);
    var user_id = Number(req.headers.user_id);
    var answer = yield prisma.answer.delete({
        where: { id: answer_id },
    });
    var search = yield prisma.user.findFirst({
        where: { id: user_id }
    });
    if (search) {
        var points = Number(search.points) - 5;
        yield prisma.user.update({
            where: { id: user_id },
            data: { points }
        });
    }
    return res.status(200).send("answer deleted successfully");
}));
app.get("/api/delete/question", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var question_id = Number(req.headers.question_id);
    var answer = yield prisma.answer.deleteMany({
        where: { question_id },
    });
    var question = yield prisma.question.delete({
        where: { id: question_id },
    });
    return res.status(200).json(answer);
}));
app.get("/verify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = String(req.headers.auth);
    var check = jsonwebtoken_1.default.verify(token, jwtSecret, (err) => {
        if (err) {
            return res.status(202).send("Invalid token");
        }
    });
    var user = jsonwebtoken_1.default.decode(token);
    if (user != null && typeof user === "object") {
        var data = yield prisma.user.findFirst({
            where: { name: user.name },
            select: {
                id: true,
                email: true,
                name: true,
                about: true,
                tags: true,
                time: true,
                question: true,
                answer: true,
            },
        });
        return res.status(200).json(data);
    }
}));
app.post("/api/user", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var user_id = Number(req.headers.user_id);
    var data = req.body;
    var update = yield prisma.user.update({
        where: { id: user_id },
        data: {
            about: data.about,
        },
    });
    return res.status(200).send("user updated successfully");
}));
app.get("/api/send/user/all", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var user = yield prisma.user.findMany({
        select: {
            id: true,
            name: true,
            tags: true,
        },
    });
    return res.status(200).json(user);
}));
app.get("/api/send/user/:name", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var name = String(req.params.name);
    var user = yield prisma.user.findFirst({
        where: { name },
        select: {
            id: true,
            name: true,
            tags: true,
            about: true,
            time: true,
            question: true,
            answer: true,
            points: true
        },
    });
    return res.status(200).json(user);
}));
app.post("/api/vote", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var body = req.body;
    var id = Number(req.headers.question_id);
    var data = yield prisma.question.update({
        where: { id },
        data: {
            upvote: body.upvote,
            downvote: body.downvote
        }
    });
    return res.status(200).json(data);
}));
function otpGenerator() {
    return parseInt(String(Math.random() * 100000));
}
app.get("/api/otp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var token = String(req.headers.auth);
    var name = jsonwebtoken_1.default.decode(token);
    var search = yield prisma.user.findFirst({
        where: { name: name.name }
    });
    const otp = otpGenerator();
    if (search) {
        const info = yield transporter.sendMail({
            from: '"Medium" <process.env.User>',
            to: [`${search.email}`],
            subject: "OTP",
            html: `<p>The otp is ${otp} </p>`
        });
        return res.json({
            otp
        });
    }
}));
app.post("/chatbot", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const question = String(req.body.question);
    var arr = question.split(" ");
    var count = 0;
    arr.filter((item) => {
        if (item == "java") {
            count = 1;
            return;
        }
    });
    if (!count) {
        const result = yield model.generateContent([question]);
        var answer = result.response.text();
        return res.status(200).json({
            question,
            answer
        });
    }
    return res.status(200).json({
        question,
        answer: "No java related answer to be provided"
    });
}));
function amount(price) {
    if (price == 100) {
        return 5;
    }
    else if (price == 300) {
        return 10;
    }
    else {
        return 999;
    }
}
app.use(express_1.default.urlencoded({ extended: true }));
app.post("/success", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    var plan = Number(body.amount);
    if (body.status == "success") {
        const data = yield prisma.user.update({
            where: { email: body.email },
            data: {
                plan,
                leftQuestions: amount(body.amount)
            }
        });
        const info = yield transporter.sendMail({
            from: '"Stackoverflow" <process.env.User>',
            to: [`${body.email}`],
            subject: "Payment Sucess",
            html: `<div>The payment was sucessfull for purchasing ${body.productinfo} with price ${body.price}. The transaction is is ${body.mihpayid}</div>`
        });
        res.redirect("https://stackoverflow-sr-zeta.vercel.app/");
    }
}));
app.post("/failure", (req, res) => {
    res.redirect("https://stackoverflow-sr-zeta.vercel.app/");
});
node_cron_1.default.schedule('0 0 0 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    var data = yield prisma.user.findMany({ where: {} });
    data.map((item) => __awaiter(void 0, void 0, void 0, function* () {
        var questions = amount(Number(item.plan));
        var update = yield prisma.user.update({
            where: { id: item.id },
            data: { leftQuestions: questions }
        });
    }));
    console.log("this thing ran");
}), {
    timezone: "Asia/Kolkata"
});
app.post("/api/points/share", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const response = yield prisma.user.findFirst({
        where: { id: body.user_id }
    });
    if (response) {
        if (response.points > 10) {
            const user_points = Number(response.points) - body.points;
            const user_update = yield prisma.user.update({
                where: { id: body.user_id },
                data: { points: user_points }
            });
            const response1 = yield prisma.user.findFirst({
                where: { name: body.sent_name }
            });
            if (response1) {
                const sent_points = Number(response1.points) + Number(body.points);
                const sent_update = yield prisma.user.update({
                    where: { name: body.sent_name },
                    data: { points: sent_points }
                });
            }
        }
        return res.status(200).send("Points update");
    }
    else {
        return res.status(202).send("Not enough points to update");
    }
}));
app.post("/answer/vote", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var body = req.body;
    var data = yield prisma.answer.findFirst({
        where: { id: Number(body.answer_id) }
    });
    var update = yield prisma.answer.update({
        where: { id: Number(body.answer_id) },
        data: { upvote: body.upvote,
            downvote: body.downvote
        }
    });
    if (data) {
        var updateUser = yield prisma.user.findFirst({
            where: { id: Number(data.user_id) }
        });
        if (updateUser) {
            if (body.voteType == "upvote") {
                var updatedPoints = Number(updateUser.points) + 5;
                var update1 = yield prisma.user.update({
                    where: { id: Number(data.user_id) },
                    data: { points: updatedPoints }
                });
            }
            else if (body.voteType == "downvote") {
                var updatedPoints = Number(updateUser.points) - 5;
                var update1 = yield prisma.user.update({
                    where: { id: Number(data.user_id) },
                    data: { points: updatedPoints }
                });
            }
        }
    }
    return res.status(200).send("Voted successfully");
}));
app.listen(3000);
