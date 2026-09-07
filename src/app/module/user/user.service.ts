import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
    // Step 1: Cloudinary te upload kora, Promise diye wrap kore await-able banano
    const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
                if (error) {
                    console.log(error);
                    return reject(new Error(error.message));
                }

                if(!result){
                     return reject(new Error("No result returned from cloudinary"))
                }
                resolve(result);
            }
        );
        stream.end(buffer);
    });

    // Step 2: Ekhon cloudinaryResult available, DB update korte paren
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            imageUrl: cloudinaryResult?.secure_url,
            imagePublicId: cloudinaryResult?.public_id,
        },
    });

    return updatedUser;
};

export const UserService = {
    uploadProfileImage,
};