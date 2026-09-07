import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
    // Step 1: Purono user data ber kora (purono image thakle delete korar jonno)
    const existingUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // Step 2: Cloudinary te upload kora, Promise diye wrap kore await-able banano
    const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
                if (error) {
                    console.log(error);
                    return reject(new Error(error.message));
                }

                if (!result) {
                    return reject(new Error("No result returned from cloudinary"));
                }

                resolve(result);
            }
        );
        stream.end(buffer);
    });

    // Step 3: DB update kora notun image URL diye
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            imageUrl: cloudinaryResult.secure_url,
            imagePublicId: cloudinaryResult.public_id,
        },
        omit:{
            password: true
        }
    });

    // Step 4: Purono image thakle Cloudinary theke delete kora
    if (existingUser.imagePublicId) {
        try {
            await cloudinary.uploader.destroy(existingUser.imagePublicId);
        } catch (error) {
            // Delete fail hole pura operation fail koraite chai na,
            // tai shudhu log kore aage bere jabo
            console.log("Failed to delete old image:", error);
        }
    }

    return updatedUser;
};

export const UserService = {
    uploadProfileImage,
};