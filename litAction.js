const go = async () => {
    try {
      // Build the message payload for Gaia's API
      const messages = [
        {
          role: "system",
          content: "You are a weather advisor. Provide a single sentence recommendation based on the temperature."
        },
        {
          role: "user",
          content: `Given the temperature is${temp}°F, what should I wear today?`
        }
      ];
      console.log(messages);
      // Make API request to Gaia's LLM API
      const response = await fetch("https://llama3b.gaia.domains/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3b",
          messages
        })
      });
  
      const result = await response.json();
      const recommendation = result.choices[0].message.content;
  
      // Check temperature threshold for signing
      console.log("🌡️ Checking temperature threshold for signing");
      if (temp > 60) {
        console.log("✍️ Temperature above 60°F, requesting signature");
        try {
          const sigShare = await LitActions.signEcdsa({ toSign, publicKey, sigName });
          console.log("✅ Signature successfully obtained");
        } catch (sigError) {
          console.error("❌ Error obtaining signature:", sigError);
          throw sigError;
        }
      } else {
        console.log("❄️ Temperature below threshold, skipping signature");
      }
  
      // Prepare and return response
      const returnableResponse = {
        temperature: temp,
        recommendation,
        isWarm: temp > 60
      };
      
      console.log("📤 Sending final response:", JSON.stringify(returnableResponse, null, 2));
      LitActions.setResponse({ returnableResponse });
  
    } catch (error) {
      console.error("❌ Error in Lit Action:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      LitActions.setResponse({
        response: { 
          error: error.message,
          errorType: error.name,
          errorDetails: error.stack
        }
      });
    }
    console.log("🏁 Lit Action execution completed");
  };
  
  go();