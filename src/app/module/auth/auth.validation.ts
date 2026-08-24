import z from "zod";

const patientRegistrationZodSchema = z.object({
  name: z
    .string({
      error: "Name is required",
    })
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be at most 50 characters"),

  email: z
    .email("Please provide a valid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string({
      error: "Password is required",
    })
    .min(8, "Password must be at least 8 characters")
    .max(20, "Password must be at most 20 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  patient: z.object({
    contactNumber: z
      .string()
      .trim()
      .regex(
        /^01[3-9]\d{8}$/,
        "Please provide a valid Bangladeshi phone number"
      )
      .optional(),

    age: z
      .number({
        error: "Age is required",
      })
      .int("Age must be a whole number")
      .min(1, "Age must be at least 1")
      .max(120, "Age must be at most 120"),
  }),
});


export const userValidation = {
    patientRegistrationZodSchema
}