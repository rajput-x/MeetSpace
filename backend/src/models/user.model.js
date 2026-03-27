import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, required: true }
    },
    { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
