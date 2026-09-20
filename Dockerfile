FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY voice_studio/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy all studio application files
COPY voice_studio/ .

# Render dynamically passes the PORT environment variable (defaulting to 10000)
ENV PORT=10000
EXPOSE 10000

CMD ["python", "server.py"]
