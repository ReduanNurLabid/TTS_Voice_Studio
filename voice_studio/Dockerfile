FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all studio files
COPY . .

# Hugging Face Spaces listens on port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "server.py"]
