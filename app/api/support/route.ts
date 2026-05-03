import { z } from "zod"
import { sendSupportTicketToCRM } from "@/lib/crm"

const supportSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = supportSchema.safeParse(json)

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { email, subject, message } = parsed.data

    const success = await sendSupportTicketToCRM({
      email,
      subject,
      message
    })

    if (success) {
      return Response.json({ message: "Ticket created successfully" })
    } else {
      return Response.json({ error: "Failed to create support ticket in CRM" }, { status: 500 })
    }
  } catch (error) {
    console.error("Support API Error:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
