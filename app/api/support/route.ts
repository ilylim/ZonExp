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

    // ПР-06: Интеграция с BPMS ELMA365 (Web API)
    let bpmsSuccess = false;
    try {
      const elmaUrl = process.env.ELMA365_API_URL;
      const elmaToken = process.env.ELMA365_API_TOKEN;

      if (elmaUrl && elmaToken && elmaToken !== "your_token_here") {
        console.log("[DEBUG BPMS] Sending support ticket to ELMA365 Web API...");
        const elmaRes = await fetch(elmaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${elmaToken}`
          },
          body: JSON.stringify({
            context: {
              __name: subject, // Стандартное название карточки
              opisanie_oshibki: message,
              id_polzovatelya: email
            }
          })
        });
        bpmsSuccess = elmaRes.ok;
        if (bpmsSuccess) {
          console.log("[DEBUG BPMS] Process successfully started in ELMA365");
        } else {
          console.error("[DEBUG BPMS] ELMA365 returned status:", elmaRes.status, await elmaRes.text());
        }
      } else {
        console.log("[DEBUG BPMS] ELMA365 API is not fully configured in .env");
      }
    } catch (e) {
      console.error("[DEBUG BPMS] ELMA365 API Error:", e);
    }

    if (success || bpmsSuccess) {
      return Response.json({ 
        message: "Ticket processed", 
        crm_triggered: success, 
        bpms_triggered: bpmsSuccess 
      })
    } else {
      return Response.json({ error: "Failed to process support ticket in any service" }, { status: 500 })
    }
  } catch (error) {
    console.error("Support API Error:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
