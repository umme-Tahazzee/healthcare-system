// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>
import { Router } from "express";

import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";



const router = Router();
router.post(
  "/apply-as-doctor",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 4 },
  ]),
  DoctorController.applyAsDoctor
);



export const DoctorRoutes = router;