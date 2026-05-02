import { POST as startQuest } from "@/app/api/quests/start/route"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  return startQuest(req)
}
