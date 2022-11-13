import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const nomeSchema = joi.object({
  name: joi.string().min(1).required(),
});

const messageSchema = joi.object({
  to: joi.string().min(1).required(),
  text: joi.string().min(1).required(),
  type: joi.string().valid("message", "private_message").required(),
});

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("batepapouol");
} catch (err) {
  console.log(err);
}

const time = dayjs().format("HH/mm/ss");

app.post("/participants", async (req, res) => {
  const name = req.body;

  const newParticipant = {
    name,
    lastStatus: Date.now(),
  };

  const newMessage = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: time,
  };

  const validation = nomeSchema.validate(name, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const nameExist = await db
      .collection("participants")
      .findOne({ name: name });

    if (nameExist) {
      return res.status(409).send({ message: "Esse nome já está cadastrado" });
    }

    await db.collection("participants").insertOne({ newParticipant });
    await db.collection("messages").insertOne({ newMessage });

    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();
    console.log(allParticipants);
    res.send(allParticipants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const body = req.body;
  console.log(body);
  const user = req.headers;

  const validation = messageSchema.validate(body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((details) => details.message);
    return res.send(errors);
  }

  try {
    const userExist = db.collection("participants").findOne({ name: user });

    if (!userExist) {
      return res.sendStatus(422);
    }

    await db.collection("messages").insertOne({ ...body, time: time });
    return res.sendStatus(201);
  } catch (err) {
    console.log(err);
    return res.sendStatus(422);
  }
});

app.get("/messages", async (req, res) => {
  let { limit } = parseInt(req.query);
  const user = req.headers;

  try {
    const allMessages = await db.collection("messages").find({}).toArray();
    const todasMensagens = [];

    for (let i = 0; i < allMessages.length; i++) {
      if (
        allMessages[i].type === "message" ||
        (allMessages[i].type === "private_message" && allMessages[i].to === user) ||
        (allMessages[i].type === "private_message" && allMessages[i].from === user)
      ) {
        todasMensagens.push(allMessages[i]);
      }
    }

    console.log(todasMensagens, allMessages);
    if (!limit) {
      limit = todasMensagens.length;
    }

    const limitedMessages = todasMensagens.slice(0, limit);

    res.send(limitedMessages);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers;

  try {
    const userExist = await db
      .collection("participants")
      .findOne({ name: user });

    if (!userExist) {
      return res.sendStatus(404);
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.status(200).send("OK");
  } catch (err) {
    res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("Running in port 5000");
});
