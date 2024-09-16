//endpoint to signup, signin , add question,add answer, update question, update answer, delete question and answer alltogether,delete answer specifiaclly,update about &tags,upvote and downvote,time integration,token verifiaction
import express, { Request, Response } from "express";
import { z } from "zod";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import jwt,{JwtPayload} from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron"
import nodemailer from "nodemailer"
import moment from "moment-timezone"
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(
  "AIzaSyAJgz8ghfOcVzkzPBrU1OBPR-Y1JApEZm0"
);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const currentDate = new Date();
const prisma = new PrismaClient();
const app = express();
const jwtSecret = "sr1435";
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: "mediumblog10@gmail.com",
    pass: "yffk tvgz byen jeqa",
  },
});  
app.use(cors());
app.use(express.json());

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const postSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  tags: z.string(),
});

app.post("/auth/signup", async (req: Request, res: Response) => {
  var body = req.body;
  var check = signupSchema.safeParse(body);
  if (!check.success) {
    return res.status(202).send("Wrong format of the email or password");
  }
  var user = await prisma.user.findFirst({
    where: { email: body.email },
  });
  if (user != null) {
    return res.status(202).send("User already exists, signin");
  }

  var hashedPassword = await bcrypt.hash(body.password, 10);
  var data = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashedPassword,
      time: currentDate.getTime() / 100,
    },
  });
  if (data != null) {
    var token = jwt.sign({ name: body.name }, jwtSecret);
    return res.status(200).send(token + "+" + data.name[0].toUpperCase());
  }
});

app.post("/auth/signin", async (req: Request, res: Response) => {
  var body = req.body;
  var check = signinSchema.safeParse(body);
  if (!check.success) {
    return res.status(202).send("Wrong format of the email or password");
  }
  var user = await prisma.user.findFirst({
    where: { email: body.email },
  });
  if (user == null) {
    return res.status(202).send("User doesnt exists, signup");
  } else if (user != null) {
    var check1 = await bcrypt.compare(body.password, user.password);
    if (!check1) {
      return res.status(202).send("Wrong password");
    }
    var token = jwt.sign({ name: user.name }, jwtSecret);
    return res.status(200).send(token + "+" + user.name[0].toUpperCase());
  }
});

app.use("/api/*", (req: Request, res: Response, next) => {
  var token = String(req.headers.auth);
  var check = jwt.verify(token, jwtSecret, (err) => {
    if (err) {
      return res.status(202).send("Invalid token");
    }
    next();
  });
});

app.post("/api/question", async (req: Request, res: Response) => {
  var token = String(req.headers.auth);
  var body = req.body;
  var verify = jwt.decode(token);
  if (verify !== null && typeof verify === "object") {
    var data = await prisma.user.findFirst({
      where: { name: verify.name },
    });
    if (data != null) {
      if(data.leftQuestions>0){
      var question = await prisma.question.create({
        data: {
          user_id: data.id,
          name: data.name,
          title: body.title,
          description: body.description,
          tags: body.tags,
          time: currentDate.getTime() / 100,
        },
      });
      var update = await prisma.user.update({
        where:{name:verify.name},
        data:{leftQuestions:Number(data.leftQuestions-1)}
      })
      return res.status(200).json(question);
    }
    else{
      return res.status(202).send("Out of questions limit");
    }
    }
  }
});

app.post("/api/answer", async (req: Request, res: Response) => {
  var token = String(req.headers.auth);
  var body = req.body;
  var verify = jwt.decode(token);
  if (verify !== null && typeof verify === "object") {
    var data = await prisma.user.findFirst({
      where: { name: verify.name },
    });
    if (data != null) {
      var question = await prisma.answer.create({
        data: {
          user_id: data.id,
          name: data.name,
          question_id: body.id,
          answer: body.answer,
          time: currentDate.getTime() / 100,
        },
      });
      var send = await prisma.question.findFirst({
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
      return res.status(200).json(send);
    }
  }
});

app.get("/send/all", async (req: Request, res: Response) => {
  var data = await prisma.question.findMany({
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
});
app.get("/send/:id", async (req: Request, res: Response) => {
  var id = Number(req.params.id);
  var data = await prisma.question.findFirst({
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
});

app.put("/api/question", async (req: Request, res: Response) => {
  var question_id = Number(req.headers.question_id);
  var data = req.body; //just the question in fromat of title and description
  var question = await prisma.question.update({
    where: { id: question_id },
    data: {
      title: data.title,
      description: data.description,
    },
  });
  return res.status(200).send("question updated successfully");
});
app.put("/api/answer", async (req: Request, res: Response) => {
  var answer_id = Number(req.headers.answer_id);
  var data = req.body; //just the answer
  var answer = await prisma.answer.update({
    where: { id: answer_id },
    data: {
      answer: data.answer,
    },
  });
  return res.status(200).send("question updated successfully");
});
app.get("/api/delete/answer", async (req: Request, res: Response) => {
  var answer_id = Number(req.headers.answer_id);
  var answer = await prisma.answer.delete({
    where: { id: answer_id },
  });
  return res.status(200).send("answer deleted successfully");
});
app.get("/api/delete/question", async (req: Request, res: Response) => {
  var question_id = Number(req.headers.question_id);
  var answer = await prisma.answer.deleteMany({
    where: { question_id },
  });
  var question = await prisma.question.delete({
    where: { id: question_id },
  });

  return res.status(200).json(answer);
});
//token verifaiction useEffect----->run on click of signin
app.get("/verify", async (req: Request, res: Response) => {
  const token = String(req.headers.auth);
  var check = jwt.verify(token, jwtSecret, (err: any) => {
    if (err) {
      return res.status(202).send("Invalid token");
    }
  });
  var user = jwt.decode(token);
  if (user != null && typeof user === "object") {
    var data = await prisma.user.findFirst({
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
});
//update the tags or about
app.post("/api/user", async (req: Request, res: Response) => {
  var user_id = Number(req.headers.user_id);
  var data = req.body;
  var update = await prisma.user.update({
    where: { id: user_id },
    data: {
      about: data.about,
      tags: data.tags,
    },
  });
  return res.status(200).send("user updated successfully");
});
//fetch all users and respective and update votes directly
app.get("/api/send/user/all", async (req: Request, res: Response) => {
  var user = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      tags: true,
    },
  });
  return res.status(200).json(user)
});
app.get("/api/send/user/:name", async (req: Request, res: Response) => {
  var name= String(req.params.name)
  var user = await prisma.user.findFirst({
    where: { name},
    select: {
      id: true,
      name: true,
      tags: true,
      about:true,
      time:true,
      question:true,
      answer:true

    },
  });
  return res.status(200).json(user)
});
//updating upvote and downvote at once 
app.post("/api/vote",async(req:Request,res:Response)=>{
  var body=req.body;
 var id=Number(req.headers.question_id)
 var data = await prisma.question.update({
  where:{id},
  data:{
    upvote:body.upvote,
    downvote:body.downvote
  }
 })
 return res.status(200).json(data)
})
//sending email endpoint
function otpGenerator(){
  return parseInt(String(Math.random()*100000))
}
app.get("/api/otp",async(req:Request,res:Response)=>{
  var token=String(req.headers.auth);
  var name = jwt.decode(token) as JwtPayload; 
  var search= await prisma.user.findFirst({
    where:{name:name.name}
  })
  const otp= otpGenerator();
  if(search){
    const info = await transporter.sendMail({
      from: '"Medium" <process.env.User>', // sender address
      to: [`${search.email}`], // list of receivers
      subject: "OTP", // Subject line
      html: `<p>The otp is ${otp} </p>`// plain text body
    });
  return res.json({
    otp
  })
  

  }
})
app.post("/chatbot",async(req:Request,res:Response)=>{
    const question=String(req.body.question);
    var arr=question.split(" ");
    var count =0;
    arr.filter((item:string)=>{
      if(item=="java"){
        count=1;
        return;
      }
    })
    if(!count){
      const result = await model.generateContent([question]);
      var answer=result.response.text();
      return res.status(200).json({
        question,
        answer
      })
    }
    return res.status(200).json({
      question,
      answer:"No java related answer to be provided"
    })
    
})
//question calculator based on amount 
function amount(price:Number){
  if(price==100){
    return 5;
  }
  else if(price==300){
    return 10;
  }
  else {
    return 999;
  }
}
//keeps default plan and then updates on successfull payment--does iq.t only the successful payment
//payment gateway
// payment verification
app.use(express.urlencoded({ extended: true }));
app.post("/success",async(req:Request,res:Response)=>{
  const body=req.body;
  var plan =Number(body.amount)
  if(body.status=="success"){
    const data = await prisma.user.update({
      where:{email:body.email},
      data:{
        plan,
        leftQuestions:amount(body.amount)
      }
    })
    const info = await transporter.sendMail({
      from: '"Stackoverflow" <process.env.User>', // sender address
      to: [`${body.email}`], // list of receiver5123-4567-8901-2346s
      subject: "Payment Sucess", // Subject line
      html: `<div>The payment was sucessfull for purchasing ${body.productinfo} with price ${body.price}. The transaction is is ${body.mihpayid}</div>`// plain text body
    });
      
      res.redirect("https://stackoverflow-sr-zeta.vercel.app/")
      
      
  }
})
app.post("/failure",(req:Request,res:Response)=>{
      res.send("Payment has failed")
})

cron.schedule('0 0 0 * * *',async()=>{
  var data = await prisma.user.findMany({where:{}});
  data.map(async(item:any)=>{
   var questions = amount(Number(item.plan));
   var update = await prisma.user.update({
    where:{id:item.id},
    data:{leftQuestions:questions}
   })
  })
  console.log("this thing ran")
},{
  timezone:"Asia/Kolkata"
})


app.listen(3000);
