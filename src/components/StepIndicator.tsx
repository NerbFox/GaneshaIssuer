"use client";

import React from "react";
import { ThemedText } from "./ThemedText";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <div className="flex items-center w-full border justify-start">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center flex-1">
            {/* Step Circle */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center mb-2 ${
                step.number <= currentStep
                  ? "bg-[#0D2B45]"
                  : "bg-white border border-gray-300"
              }`}
            >
              <ThemedText
                fontSize={10}
                fontWeight={700}
                className={`${
                  step.number <= currentStep
                    ? "text-white"
                    : "text-gray-400"
                }`}
              >
                {step.number}
              </ThemedText>
            </div>
            {/* Step Label */}
            <ThemedText
              fontSize={12}
              fontWeight={500}
              className={`text-center ${
                step.number <= currentStep
                  ? "text-[#0D2B45]"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </ThemedText>
          </div>

          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 bg-gray-300 mx-2 mb-8" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
