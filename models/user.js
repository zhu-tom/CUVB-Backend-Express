const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    type: String,
    created: Date,
});

const User = mongoose.model("users", userSchema, "users");

module.exports = User;