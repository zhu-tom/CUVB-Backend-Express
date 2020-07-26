const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    attendees: [mongoose.ObjectId],
    details: String,
    date: {day: Date, start: String, end: String},
});
const Event = mongoose.model("events", eventSchema, "events");

module.exports = Event;