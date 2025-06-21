const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

const jobManifest = require('./jobTemplate.json'); // or dynamically generate

k8sBatchApi.createNamespacedJob('default', jobManifest)
  .then(() => console.log('Job submitted'))
  .catch(err => console.error('Job failed:', err));