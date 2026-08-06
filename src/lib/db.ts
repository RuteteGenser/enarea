import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Annotation, BuildingComponentType, PdfFile, Project } from '@/types';

interface EnareaDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  files: {
    key: string;
    value: PdfFile;
    indexes: { 'by-project': string };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-file': string };
  };
  buildingComponentTypes: {
    key: string;
    value: BuildingComponentType;
  };
}

let dbPromise: Promise<IDBPDatabase<EnareaDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<EnareaDB>('enarea', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('projects', { keyPath: 'id' });
          const files = db.createObjectStore('files', { keyPath: 'id' });
          files.createIndex('by-project', 'projectId');
          const annotations = db.createObjectStore('annotations', { keyPath: 'id' });
          annotations.createIndex('by-file', 'fileId');
        }
        if (oldVersion < 2) {
          db.createObjectStore('buildingComponentTypes', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const projectsRepo = {
  async list(): Promise<Project[]> {
    const db = await getDb();
    const all = await db.getAll('projects');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id: string): Promise<Project | undefined> {
    const db = await getDb();
    return db.get('projects', id);
  },
  async put(project: Project): Promise<void> {
    const db = await getDb();
    await db.put('projects', project);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['projects', 'files', 'annotations'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    const files = await tx.objectStore('files').index('by-project').getAll(id);
    for (const file of files) {
      await tx.objectStore('files').delete(file.id);
      const annotations = await tx.objectStore('annotations').index('by-file').getAllKeys(file.id);
      for (const annotationId of annotations) {
        await tx.objectStore('annotations').delete(annotationId);
      }
    }
    await tx.done;
  },
};

export const filesRepo = {
  async listByProject(projectId: string): Promise<PdfFile[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('files', 'by-project', projectId);
    return all.sort((a, b) => a.order - b.order);
  },
  async get(id: string): Promise<PdfFile | undefined> {
    const db = await getDb();
    return db.get('files', id);
  },
  async put(file: PdfFile): Promise<void> {
    const db = await getDb();
    await db.put('files', file);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['files', 'annotations'], 'readwrite');
    await tx.objectStore('files').delete(id);
    const annotationIds = await tx.objectStore('annotations').index('by-file').getAllKeys(id);
    for (const annotationId of annotationIds) {
      await tx.objectStore('annotations').delete(annotationId);
    }
    await tx.done;
  },
};

export const annotationsRepo = {
  async listByFile(fileId: string): Promise<Annotation[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('annotations', 'by-file', fileId);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async put(annotation: Annotation): Promise<void> {
    const db = await getDb();
    await db.put('annotations', annotation);
  },
  async putAll(annotations: Annotation[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('annotations', 'readwrite');
    for (const annotation of annotations) {
      await tx.store.put(annotation);
    }
    await tx.done;
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('annotations', id);
  },
  async replaceAllForFile(fileId: string, annotations: Annotation[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('annotations', 'readwrite');
    const existingKeys = await tx.store.index('by-file').getAllKeys(fileId);
    for (const key of existingKeys) {
      await tx.store.delete(key);
    }
    for (const annotation of annotations) {
      await tx.store.put(annotation);
    }
    await tx.done;
  },
};

export const buildingComponentTypesRepo = {
  async list(): Promise<BuildingComponentType[]> {
    const db = await getDb();
    const all = await db.getAll('buildingComponentTypes');
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async get(id: string): Promise<BuildingComponentType | undefined> {
    const db = await getDb();
    return db.get('buildingComponentTypes', id);
  },
  async put(type: BuildingComponentType): Promise<void> {
    const db = await getDb();
    await db.put('buildingComponentTypes', type);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('buildingComponentTypes', id);
  },
};
