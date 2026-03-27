import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        meetingCode: { type: String, required: true },
        date: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

export const Meeting = mongoose.model("Meeting", meetingSchema);
