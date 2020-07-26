require('dotenv').config()

const express = require("express");
const bcrypt = require("bcrypt");
const salt_rounds = 10;
const mongoose = require("mongoose");
const cors = require("cors");

const Event = require("./models/event");
const User = require("./models/user");

const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(`mongodb+srv://${process.env.GATSBY_DB_USER}:${process.env.GATSBY_DB_PASS}@${process.env.GATSBY_DB_URL}/${process.env.GATSBY_DB_NAME}?retryWrites=true&w=majority`, {useNewUrlParser: true}).then(() => {
    console.log("connected to mongodb");
}).catch((err) => {
    console.log(err);
});

app.post('/api/login', (req, res) => {
    console.log("loggin in...");
    const { email, password } = req.body;
    User.findOne({ email: email }, (err, doc) => {
        if (err) res.send(JSON.stringify({err: err}));
        if (doc) {
            bcrypt.compare(password, doc.password, (err, same) => {
                if (err) res.send(JSON.stringify({err: err}));
                if (same) {
                    delete doc.password;
                    res.send(JSON.stringify(doc));
                } else {
                    res.send(JSON.stringify({err: "wrong pass"}));
                }
            });
        } else {
            res.send(JSON.stringify({err: 'no email match'}));
        }
    });
});

app.post('/api/signup', (req, res) => {
    console.log("signing up...");
    const { name, email, password } = req.body;

    if (name && email && password) {
        User.findOne({ email: email }).then(value => {
            if (!value) {
                bcrypt.hash(password, salt_rounds, (err, hash) => {
                    new User({
                        name: name,
                        email: email,
                        password: hash,
                        type: "basic",
                        created: Date.now()
                    }).save((err, user) => {
                        if (err) res.send(JSON.stringify({err: err}));
                        user = user.toJSON();
                        delete user.password;
                        res.send(JSON.stringify(user));
                    });
                });
            }
        }); 
    }
});

app.post('/api/events/add', (req, res) => {
    console.log(req.headers.authorization);
    const { date, start, end, markdown } = req.body;
    if (req.headers.authorization === process.env.ADMIN_ID) {
        new Event({
            details: markdown,
            attendees: [],
            date: {
                day: date,
                start: start,
                end: end,
            }
        }).save((err) => {
            if (err) res.send(JSON.stringify({err: err}));
            else res.send({msg: "good"});
        });
    }
    else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.post('/api/events/signup', (req, res) => {
    const { user_id, event_id } = req.body;
    User.findById(user_id, (err, document) => {
        if (err) res.send(JSON.stringify({err: err}));
        if (!document) res.send(JSON.stringify({err: "no user"}));
        Event.findOne({_id: event_id, attendees: {$not : { $eq: user_id}}}, (err, doc) => {
            if (err) res.send(JSON.stringify({err: err}));
            if (doc) res.send(JSON.stringify({err: "already in"}));
            else {
                doc.update({ $push: {attendees: user_id}});
                res.send();
            }
        });
    });
});

app.get("/api/events/get", (req, res) => {
    if (req.headers.authorization === process.env.ADMIN_ID) {
        const { id } = req.query;
        if (id) {
            Event.findById(id, (err, doc) => {
                if (err) res.send(JSON.stringify({err: err}));
                if (!doc) res.send(JSON.stringify({err: "bad id"}));
                else res.send(JSON.stringify(doc.toJSON()));
            });
        } else {
            res.send(JSON.stringify({err: "no id"}));
        }
    } else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.get('/api/hello', (req, res) => {
    res.send(JSON.stringify({msg: "hello"}));
});

app.listen(port, () => console.log(`started listening on ${port}`));