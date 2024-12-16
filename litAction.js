const go = async () => {
  try {
    // Fetch current temperature from weather API
    console.log("🌤️ Fetching weather data...");
    const weatherResponse = await fetch(
      "https://api.weather.gov/gridpoints/TOP/31,80/forecast"
    );
    
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }
    
    const weatherData = await weatherResponse.json();
    const currentTemp = weatherData.properties.periods[0].temperature;
    console.log(`🌡️ Current temperature: ${currentTemp}°F`);

    // Build the message payload for Gaia's API
    const messages = [
      {
        role: "system",
        content: "You are a weather advisor. Provide a single sentence recommendation based on the temperature."
      },
      {
        role: "user", 
        content: `Given the temperature is ${currentTemp}°F, what should I wear today?`
      }
    ];
    console.log("📝 Preparing LLM query:", messages);

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

    // Create message to sign
    const messageToSign = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`Temperature: ${currentTemp}°F`)
      )
    );

    // Check temperature threshold for signing
    console.log("🌡️ Checking temperature threshold for signing");
    let signature = null;
    
    if (currentTemp > 60) {
      console.log("✍️ Temperature above 60°F, requesting signature");
      try {
        signature = await LitActions.signEcdsa({ 
          toSign: messageToSign, 
          publicKey, 
          sigName 
        });
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
      temperature: currentTemp,
      recommendation,
      isWarm: currentTemp > 60,
      signature: signature
    };
    
    console.log("📤 Sending final response:", JSON.stringify(returnableResponse, null, 2));
    LitActions.setResponse({ response: returnableResponse });

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