import Link from 'next/link';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ViewerQuery,
  useViewerQuery,
  useUpdateNameMutation,
  ViewerDocument,
} from '../lib/viewer.graphql';
import { initializeApollo } from '../lib/apollo';

import * as Comlink from 'comlink';
import { WorkerApi } from '../workers/comlink.worker';

const Index = () => {
  const { viewer } = useViewerQuery().data!;
  const [newName, setNewName] = useState('');
  const [updateNameMutation] = useUpdateNameMutation();

  const onChangeName = () => {
    updateNameMutation({
      variables: {
        name: newName,
      },
      //Follow apollo suggestion to update cache
      //https://www.apollographql.com/docs/angular/features/cache-updates/#update
      update: (cache, mutationResult) => {
        const { data } = mutationResult;
        if (!data) return; // Cancel updating name in cache if no data is returned from mutation.
        // Read the data from our cache for this query.
        const { viewer } = cache.readQuery({
          query: ViewerDocument,
        }) as ViewerQuery;
        const newViewer = { ...viewer };
        // Add our comment from the mutation to the end.
        newViewer.name = data.updateName.name;
        // Write our data back to the cache.
        cache.writeQuery({
          query: ViewerDocument,
          data: { viewer: newViewer },
        });
      },
    });
  };
  // for comlink
  const [comlinkMessage, setComlinkMessage] = useState('');
  const comlinkWorkerRef = useRef<Worker>();
  const comlinkWorkerApiRef = useRef<Comlink.Remote<WorkerApi>>();

  useEffect(() => {
    // Comlink worker
    comlinkWorkerRef.current = new Worker(
      new URL('../workers/comlink.worker.ts', import.meta.url)
    );
    comlinkWorkerApiRef.current = Comlink.wrap<WorkerApi>(
      comlinkWorkerRef.current
    );
    return () => {
      comlinkWorkerRef.current?.terminate();
    };
  }, []);

  const handleComlinkWork = async () => {
    const msg = await comlinkWorkerApiRef.current?.getName();
    setComlinkMessage(`Comlink response => ${msg}`);
  };

  const workerRef = useRef();
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/worker.js', import.meta.url)
    );
    workerRef.current.onmessage = (evt) =>
      alert(`WebWorker Response => ${evt.data}`);
    return () => {
      workerRef.current.terminate();
    };
  }, []);

  const handleWork = useCallback(async () => {
    workerRef.current.postMessage(100000);
  }, []);
  return (
    <div>
      Random word: {comlinkMessage}. You're signed in as {viewer.name} and
      you're {viewer.status} . Go to the{' '}
      <Link href="/about">
        <a>about</a>
      </Link>{' '}
      page.
      <div>
        <input
          type="text"
          placeholder="your new name..."
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="button"
          value="change"
          onClick={() => {
            onChangeName();
            handleWork();
            handleComlinkWork();
          }}
        />
      </div>
    </div>
  );
};

export async function getStaticProps() {
  const apolloClient = initializeApollo();

  await apolloClient.query({
    query: ViewerDocument,
  });

  return {
    props: {
      initialApolloState: apolloClient.cache.extract(),
    },
  };
}

export default Index;
