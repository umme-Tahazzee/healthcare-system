// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>
import { Router } from "express";

import { upload } from "../../lib/multer";
import { DoctorController } from "./doctor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";



const router = Router();
router.post(
  "/apply-as-doctor",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 4 },
  ]),
  DoctorController.applyAsDoctor
);


router.post(
  "/apply-as-doctor/verify-email",
  DoctorController.verifyDoctorEmail
);


router.post(
  "/approve-doctor",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  DoctorController.approvedDoctor
);


router.get('/all-doctors',
  auth(Role.ADMIN, Role.SUPER_ADMIN), 
  DoctorController.getAllDoctors)




export const DoctorRoutes = router;