require('dotenv').config()

const express = require("express");
const bcrypt = require("bcrypt");
const salt_rounds = 10;
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");

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

app.post('/api/users/get', async (req, res) => {
    let {users, event_id} = req.body;
    
    if (event_id) {
        const event = await Event.findById(event_id);
        users = event.attendees;
    }

    let result = [];
    for (const id of users) {
        const user = await User.findById(id);
        if (user) {
            const {password, created, ...rest} = user.toJSON();
            result.push(rest);
        }
    }

    res.send(JSON.stringify(result));
});

app.post("/api/events/attendees/delete", (req, res) => {
    const {event_id, user_id} = req.body;

    pullFromEvent(event_id, user_id, (err) => {
        if (err) res.send(JSON.stringify({err:err}));
        else {
            res.send(JSON.stringify({msg: "success"}));
        }
    });
});

const pullFromEvent = (event_id, user_id, callback) => {
    Event.updateOne({_id: event_id}, {$pull: {attendees: user_id}}, (err) => {
        callback(err);
    });
}

app.post('/api/events/add', (req, res) => {
    const { date, start, end, markdown, title, location, subtitle} = req.body;
    if (req.headers.authorization === process.env.ADMIN_ID) {
        new Event({
            title: title,
            subtitle: subtitle,
            details: markdown,
            attendees: [],
            date: {
                day: date,
                start: start,
                end: end,
            },
            location: location
        }).save((err) => {
            if (err) res.send(JSON.stringify({err: err}));
            else {
                
                res.send({msg: "good"});
            }
        });
    }
    else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.post('/api/events/delete', (req, res) => {
    const {id} = req.body;
    if (req.headers.authorization === process.env.ADMIN_ID) {
        Event.deleteOne({_id: id}, (err) => {
            if (err) res.send(JSON.stringify({err: err}));
            else res.send(JSON.stringify({msg: "success"}));
        })
    } else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.post('/api/events/signup', (req, res) => {
    const { user_id, event_id } = req.body;
    User.findById(user_id, (err, document) => {
        if (err) res.send(JSON.stringify({err: err}));
        if (!document) res.send(JSON.stringify({err: "no user"}));
        checkSignedUp(event_id, user_id).then((doc) => {
            if (!doc) {
                pullFromEvent(event_id, user_id, (err) => {
                    if (err) res.send(JSON.stringify({err:err}));
                    else res.send(JSON.stringify({msg: "success"}));
                });
            }
            else {
                doc.updateOne({ $push: {attendees: user_id}}, (err) => {
                    if (err) res.send(JSON.stringify({err:err}));
                    else res.send(JSON.stringify({msg: "success"}));
                });
            }
        }).catch(err => {
            res.send(JSON.stringify({err: err}));
        });
    });
});

const checkSignedUp = (event_id, user_id) => {
    return Event.findOne({_id: event_id, attendees: {$ne: user_id}});
}

app.post('/api/events/checkSignedUp', (req, res) => {
    const {event_id, user_id } = req.body;
    checkSignedUp(event_id, user_id).then((doc) => {
        if (!doc) res.send(JSON.stringify({err: "already in"}));
        else res.send(JSON.stringify({msg: "not in"}));
    }).catch(err => {
        res.send(JSON.stringify({err:err}));
    });
});

app.get("/api/events/get", (req, res) => {
    const { id, sort, upcoming } = req.query;

    if (req.headers.authorization === process.env.ADMIN_ID) {
        if (id) {
            Event.findById(id, (err, doc) => {
                if (err) res.send(JSON.stringify({err: err}));
                if (!doc) res.send(JSON.stringify({err: "bad id"}));
                else res.send(JSON.stringify(doc.toJSON()));
            });
        } 
        else if (sort) {
            let query = {};
            if (upcoming) query = {date: {day: {$gte: Date.now()}}};
            if (sort) {
                Event.find(query).sort({'date.day': 1}).then((docs) => {
                    res.send(JSON.stringify(docs.map(doc => doc.toJSON())));
                }).catch((err) => {
                    res.send(JSON.stringify({err: err}));
                });
            }
        }
        else {
            res.send(JSON.stringify({err: "no id"}));
        }
    } else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.post("/api/events/edit", (req, res) => {
    const { id, markdown, date, start, end, title, location, subtitle} = req.body;
    if (id && req.headers.authorization === process.env.ADMIN_ID) {
        Event.findOneAndUpdate({ _id: id}, {
            details: markdown,
            date: {
                day: date,
                start: start,
                end: end,
            },
            title: title,
            location: location,
            subtitle: subtitle,
        }, (err, doc) => {
            if (err) res.send(JSON.stringify({err: err}));
            else res.send(JSON.stringify({msg: "success"}));
        });
    } else {
        res.send(JSON.stringify({err: "bad auth"}));
    }
});

app.get("/api/rebuild", (req, res) => {
    if (req.headers.authorization === process.env.ADMIN_ID) {
        axios.post("https://api.netlify.com/build_hooks/5f1d3661b5e249c5b3753b69").then(() => {
            res.send(JSON.stringify({msg: "success"}));
        }).catch((err) => {
            res.send(JSON.stringify({err: err}));
        });
    }
});

app.get('/api/hello', (req, res) => {
    res.send(JSON.stringify({msg: "hello"}));
});

app.listen(port, () => console.log(`started listening on ${port}`));