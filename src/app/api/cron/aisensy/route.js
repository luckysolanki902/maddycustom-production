export async function GET() {
    try {
        const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";
        const AISENSY_API_KEY = process.env.AISENSY_API_KEY;

        if (!AISENSY_API_KEY) {
            console.error("AiSensy API Key is missing!");
            return Response.json(
                { success: false, error: "AiSensy API key is missing. Check your .env.local file." },
                { status: 500 }
            );
        }

        const templateParams = ["Lucky"]; // Ensure this aligns with placeholder indexing

        const payload = {
            apiKey: AISENSY_API_KEY,
            campaignName: "abandoned_cart_api",
            destination: "919027495997",
            userName: "Lucky Solanki",
            templateParams: templateParams
        };

        const response = await fetch(AISENSY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 401) {
            console.error("Unauthorized: Invalid API Key or permission issue.");
            return Response.json(
                { success: false, error: "Unauthorized: Invalid AiSensy API key or permission issue." },
                { status: 401 }
            );
        }

        const result = await response.json();

        if (response.ok) {
            return Response.json({ success: true, message: "WhatsApp message sent successfully!", data: result });
        } else {
            console.error("AiSensy API Error:", result);
            return Response.json(
                { success: false, error: result.message || "Failed to send message" },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Server error:", error);
        return Response.json({ success: false, error: error.message || "Server error" }, { status: 500 });
    }
}
