# MCP Memory Server with Qdrant Persistence

This MCP server provides a knowledge graph implementation with semantic search capabilities powered by Qdrant vector database.

## Features

- Graph-based knowledge representation with entities and relations
- File-based persistence (memory.json)
- Semantic search using Qdrant vector database
- OpenAI embeddings for semantic similarity
- HTTPS support with reverse proxy compatibility

## Environment Variables

The following environment variables are required:

```bash
# OpenAI API key for generating embeddings
OPENAI_API_KEY=your-openai-api-key

# Qdrant server URL (supports both HTTP and HTTPS)
QDRANT_URL=https://your-qdrant-server

# Qdrant API key (if authentication is enabled)
QDRANT_API_KEY=your-qdrant-api-key

# Name of the Qdrant collection to use
QDRANT_COLLECTION_NAME=your-collection-name
```

## HTTPS and Reverse Proxy Configuration

The server supports connecting to Qdrant through HTTPS and reverse proxies. This is particularly useful when:
- Running Qdrant behind a reverse proxy like Nginx or Apache
- Using self-signed certificates
- Requiring custom SSL/TLS configurations

### Setting up with a Reverse Proxy

1. Configure your reverse proxy (example using Nginx):
```nginx
server {
    listen 443 ssl;
    server_name qdrant.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:6333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

2. Update your environment variables:
```bash
QDRANT_URL=https://qdrant.yourdomain.com
```

### Security Considerations

The server implements robust HTTPS handling with:
- Custom SSL/TLS configuration
- Proper certificate verification options
- Connection pooling and keepalive
- Automatic retry with exponential backoff
- Configurable timeouts

### Troubleshooting HTTPS Connections

If you experience connection issues:

1. Verify your certificates:
```bash
openssl s_client -connect qdrant.yourdomain.com:443
```

2. Test direct connectivity:
```bash
curl -v https://qdrant.yourdomain.com/collections
```

3. Check for any proxy settings:
```bash
env | grep -i proxy
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Add to MCP settings:
```json
{
  "mcpServers": {
    "memory": {
      "command": "/bin/zsh",
      "args": ["-c", "cd /path/to/server && node dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key",
        "QDRANT_URL": "https://your-qdrant-server",
        "QDRANT_API_KEY": "your-qdrant-api-key",
        "QDRANT_COLLECTION_NAME": "your-collection-name"
      },
      "alwaysAllow": [
        "create_entities",
        "create_relations",
        "add_observations",
        "delete_entities",
        "delete_observations",
        "delete_relations",
        "read_graph",
        "search_similar"
      ]
    }
  }
}
```

[Rest of the README remains the same...]
