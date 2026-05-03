/**
 * CRM Integration Module (Bitrix24)
 * 
 * Данный модуль отвечает за интеграцию приложения ZonExp с CRM Bitrix24 
 * с использованием входящих вебхуков (Inbound Webhooks).
 */

export interface CRMLeadData {
  email: string
  username: string
  characterClass: string
  xp: number
  guild: string
  registrationDate: string // ISO string
}

export interface CRMSupportData {
  email: string
  subject: string
  message: string
}

/**
 * Создание нового контакта при регистрации
 */
export async function sendUserToCRM(data: CRMLeadData) {
  const webhookUrl = process.env.BITRIX24_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn("CRM Integration Warning: BITRIX24_WEBHOOK_URL is not defined in .env")
    return
  }

  try {
    const endpoint = `${webhookUrl.replace(/\/$/, '')}/crm.contact.add.json`
    
    console.log(`[DEBUG CRM] Attempting to send to: ${endpoint.split('/rest/')[0]}/rest/... (hidden key)`)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          NAME: data.username,
          TYPE_ID: "CLIENT",
          SOURCE_ID: "WEB",
          EMAIL: [
            { VALUE: data.email, VALUE_TYPE: "WORK" }
          ],
          UF_CRM_1777798048039: data.characterClass,
          UF_CRM_1777806255950: data.xp,
          UF_CRM_1777806269512: data.guild,
          UF_CRM_1777806157391: data.registrationDate,
        },
        params: { REGISTER_SONET_EVENT: "Y" }
      })
    })

    console.log(`[DEBUG CRM] Bitrix24 Response Status: ${response.status}`)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("[DEBUG CRM] Bitrix24 Error Payload:", errorData)
      return false
    }

    const result = await response.json()
    console.log("[DEBUG CRM] Success! Contact ID:", result.result)
    return true
  } catch (error) {
    console.error("Failed to send data to CRM:", error)
    return false
  }
}

/**
 * Отправка тикета в техподдержку
 */
export async function sendSupportTicketToCRM(data: CRMSupportData) {
  const webhookUrl = process.env.BITRIX24_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn("CRM Integration Warning: BITRIX24_WEBHOOK_URL is not defined in .env")
    return
  }

  try {
    const endpoint = `${webhookUrl.replace(/\/$/, '')}/tasks.task.add`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          TITLE: `[Support] ${data.subject}`,
          DESCRIPTION: `Отправитель: ${data.email}\n\nСообщение: ${data.message}`,
          TAGS: ["support"],
          RESPONSIBLE_ID: "1"
        }
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("CRM Bitrix24 Task API Error Response:", result)
      return false
    }

    console.log("Successfully created support task in Bitrix24. Task ID:", result.result?.task?.id || "unknown")
    return true
  } catch (error) {
    console.error("Critical error while calling Bitrix24 Task API:", error)
    return false
  }
}

/**
 * Функция обновления прогресса пользователя в CRM по Email
 */
export async function updateUserProgressInCRM(email: string, data: { xp: number, guild?: string }) {
  const webhookUrl = process.env.BITRIX24_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    const cleanUrl = webhookUrl.replace(/\/$/, '')

    // 1. Поиск ID контакта по Email
    const listEndpoint = `${cleanUrl}/crm.contact.list`
    const listResponse = await fetch(listEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { "EMAIL": email },
        select: ["ID"]
      })
    })

    const listResult = await listResponse.json()
    const contactId = listResult.result?.[0]?.ID

    if (!contactId) {
      console.warn(`CRM Sync: Contact with email ${email} not found.`)
      return false
    }

    // 2. Обновление полей
    const updateEndpoint = `${cleanUrl}/crm.contact.update`
    const updateFields: any = {
      UF_CRM_1777806255950: data.xp,
    }

    if (data.guild) {
      updateFields.UF_CRM_GUILD = data.guild
    }

    const updateResponse = await fetch(updateEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: contactId,
        fields: updateFields
      })
    })

    if (updateResponse.ok) {
      console.log(`Successfully updated CRM progress for ${email}`)
      return true
    }
    return false
  } catch (error) {
    console.error("Failed to update CRM progress:", error)
    return false
  }
}
