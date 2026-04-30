import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import wordRoutes from "../modules/words/word.routes";
import practiceRoutes from "../modules/practice/practice.routes";
import aiRoutes from "../modules/ai/ai.routes";
import placementRoutes from "../modules/placement/placement.routes";
import learningRoutes from "../modules/learning/learning.routes";

export const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/words", wordRoutes);
router.use("/practice", practiceRoutes);
router.use("/ai", aiRoutes);
router.use("/placement", placementRoutes);
router.use("/learning", learningRoutes);
