export type Sex = "female" | "male";

export type Persona = {
  name?: string;
  age: number;
  sex: Sex;
  province?: string;
  district?: string;
  occupation?: string;
  education_level?: string;
  marital_status?: string;
  family_type?: string;
  professional_persona?: string;
  culinary_persona?: string;
  travel_persona?: string;
  persona?: string;
};

export type Brand = {
  id: string;
  name: string;
  tag: string;
  desc: string;
};

export type SurveyScores = {
  awareness: number; // 1~5
  interest: number; // 1~5
  purchase_intent: number; // 1~5
  comment: string; // 40자 내외
};

export type SurveyResultItem = {
  persona: Persona;
  brand: Brand;
  scores: SurveyScores;
};

