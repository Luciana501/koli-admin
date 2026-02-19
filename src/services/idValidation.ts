export interface IDValidationResponse {
  status: "Valid" | "Invalid";
  reasons: string[];
}

export type SupportedIDType =
  | "Philippine Passport"
  | "Driver's License"
  | "SSS ID"
  | "GSIS ID"
  | "UMID"
  | "PhilHealth ID"
  | "TIN ID"
  | "Postal ID"
  | "Voter's ID"
  | "PRC ID"
  | "Senior Citizen ID"
  | "PWD ID"
  | "National ID"
  | "Others";

export interface ImageValidationResponse {
  status: "Valid" | "Invalid";
  category: "identification_card" | "selfie" | "unknown";
  message: string;
  reasons: string[];
  checks: Array<{
    name: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  confidence: number;
}

const apiBaseUrl = (import.meta.env.VITE_ID_VALIDATOR_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export const validateIdentificationNumber = async (
  idNumber: string,
  idType: SupportedIDType = "Others"
): Promise<IDValidationResponse> => {
  const response = await fetch(`${apiBaseUrl}/validate-id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id_number: idNumber, id_type: idType }),
  });

  if (!response.ok) {
    throw new Error(`ID validation request failed with status ${response.status}`);
  }

  return response.json();
};

export const analyzeIdentificationImage = async (
  imageUrl: string,
  idType: SupportedIDType = "Others",
  userName?: string
): Promise<ImageValidationResponse> => {
  const response = await fetch(`${apiBaseUrl}/analyze-id-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      image_url: imageUrl, 
      id_type: idType,
      user_name: userName || null
    }),
  });

  if (!response.ok) {
    throw new Error(`Image analysis request failed with status ${response.status}`);
  }

  return response.json();
};
