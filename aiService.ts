export const generateBOQInsights = async (boqData: any) => {
  try {
    const res = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boqData }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch insights');
    }
    
    return await res.json();
  } catch (e) {
    console.error("AI Insight Error:", e);
    return ["Unable to generate insights at this time. Please ensure your Gemini API key is correctly configured."];
  }
};
