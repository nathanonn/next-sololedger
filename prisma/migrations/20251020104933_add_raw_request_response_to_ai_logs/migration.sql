-- AlterTable
ALTER TABLE "ai_generation_logs" ADD COLUMN     "rawRequest" JSON,
ADD COLUMN     "rawResponse" JSON;
