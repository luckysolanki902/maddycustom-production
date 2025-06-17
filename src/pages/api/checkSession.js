import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (session) {
    return res.json({ 
      isLoggedIn: true, 
      user: {
        id: session.user.id,
        name: session.user.name,
        phoneNumber: session.user.phoneNumber,
        email: session.user.email
      } 
    });
  }
  
  return res.json({ isLoggedIn: false });
}