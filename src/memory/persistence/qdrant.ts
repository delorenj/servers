import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { Entity, Relation } from '../types.js';
import { QDRANT_URL, COLLECTION_NAME, OPENAI_API_KEY, QDRANT_API_KEY } from '../config.js';

interface EntityPayload extends Entity {
  type: 'entity';
}

interface RelationPayload extends Relation {
  type: 'relation';
}

type QdrantPayload = EntityPayload | RelationPayload;

function isEntity(payload: Record<string, unknown>): payload is Entity {
  return (
    typeof payload.name === 'string' &&
    typeof payload.entityType === 'string' &&
    Array.isArray(payload.observations) &&
    payload.observations.every(obs => typeof obs === 'string')
  );
}

function isRelation(payload: Record<string, unknown>): payload is Relation {
  return (
    typeof payload.from === 'string' &&
    typeof payload.to === 'string' &&
    typeof payload.relationType === 'string'
  );
}

export class QdrantPersistence {
  private client: QdrantClient;
  private openai: OpenAI;

  constructor() {
    // Validate QDRANT_URL format and protocol
    if (!QDRANT_URL.startsWith('http://') && !QDRANT_URL.startsWith('https://')) {
      throw new Error('QDRANT_URL must start with http:// or https://');
    }

    const isHttps = QDRANT_URL.startsWith('https://');
    
    this.client = new QdrantClient({ 
      url: QDRANT_URL,
      timeout: 10000, // 10 second timeout
      apiKey: QDRANT_API_KEY // Optional API key for authentication
    });

    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.getCollection(COLLECTION_NAME);
    } catch {
      // Collection doesn't exist, create it
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536, // OpenAI embedding dimension
          distance: 'Cosine'
        }
      });
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }

  private async hashString(str: string): Promise<number> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return new DataView(new Uint8Array(hashArray.slice(0, 4)).buffer).getUint32(0);
  }

  async persistEntity(entity: Entity): Promise<void> {
    const text = `${entity.name} (${entity.entityType}): ${entity.observations.join('. ')}`;
    const vector = await this.generateEmbedding(text);
    const id = await this.hashString(entity.name);

    const payload: Record<string, unknown> = {
      type: 'entity' as const,
      ...entity
    };

    await this.client.upsert(COLLECTION_NAME, {
      points: [{
        id,
        vector,
        payload
      }]
    });
  }

  async persistRelation(relation: Relation): Promise<void> {
    const text = `${relation.from} ${relation.relationType} ${relation.to}`;
    const vector = await this.generateEmbedding(text);
    const id = await this.hashString(`${relation.from}-${relation.relationType}-${relation.to}`);

    const payload: Record<string, unknown> = {
      type: 'relation' as const,
      ...relation
    };

    await this.client.upsert(COLLECTION_NAME, {
      points: [{
        id,
        vector,
        payload
      }]
    });
  }

  async searchSimilar(query: string, limit: number = 10): Promise<Array<Entity | Relation>> {
    const queryVector = await this.generateEmbedding(query);
    
    const results = await this.client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit,
      with_payload: true
    });

    const validResults: Array<Entity | Relation> = [];

    for (const result of results) {
      const payload = result.payload as Record<string, unknown>;
      
      if (payload.type === 'entity' && isEntity(payload)) {
        const { type, ...entity } = payload;
        validResults.push(entity as Entity);
      } else if (payload.type === 'relation' && isRelation(payload)) {
        const { type, ...relation } = payload;
        validResults.push(relation as Relation);
      }
    }

    return validResults;
  }

  async deleteEntity(entityName: string): Promise<void> {
    const id = await this.hashString(entityName);
    await this.client.delete(COLLECTION_NAME, {
      points: [id]
    });
  }

  async deleteRelation(relation: Relation): Promise<void> {
    const id = await this.hashString(`${relation.from}-${relation.relationType}-${relation.to}`);
    await this.client.delete(COLLECTION_NAME, {
      points: [id]
    });
  }
}
