# Kubernetes Learning Roadmap — Task Management

Objective: migrate the repo's Docker Compose stack (Postgres, Redis, PgBouncer,
SvelteKit app) into Kubernetes on a local **kind** cluster, reaching a working
app, while learning each core primitive hands-on.

Cluster: kind, single node, context `kind-vlu`.
Namespace for all workloads: `vlu`.

## Progress

- [x] **M1 — Cluster & nodes.** kind runs the cluster in Docker; each container is a node.
- [x] **M2 — Pods, Deployments, Services.** Namespace, bare Pod, Deployment→ReplicaSet→Pods, Service + Endpoints + cluster DNS.
- [x] **M3 — ConfigMap & Secret.** Split config from compose env; inject via `envFrom`; base64 is not encryption.
- [x] **M4 — Redis.** Deployment + ClusterIP Service; reach it by DNS name.- [x] **M5 — Postgres.** StatefulSet + PersistentVolumeClaim + headless Service.
- [ ] **M6 — PgBouncer.** Deployment wired to the `db` Service.
- [x] **M7 — App.** Build image, `kind load docker-image`, Deployment with env from ConfigMap/Secret.
- [x] **M8 — Probes.** Convert compose `healthcheck`s to liveness/readiness probes.
- [x] **M9 — Ingress.** Expose the app at `task.local`.
- [x] **M10 — Ops drill.** Scale, rollback, self-heal, logs, exec.
- [x] **M11 — Capstone.** Package everything with Helm or Kustomize.

## Concepts learned

### M1
- `kind create cluster` builds the cluster (once). `kubectl` then talks to the API server it wrote into `~/.kube/config`.
- `kubectl config current-context` / `kubectl cluster-info` check connectivity.
- Cluster is disposable: `kind delete cluster --name vlu`.

### M2
- Every object has `apiVersion`, `kind`, `metadata`, `spec`.
- `kubectl apply -f` is declarative: create if missing, patch if changed (idempotent). `kubectl create` is imperative and errors on re-run.
- Apply only writes objects; controllers reconcile: scheduler picks a node, kubelet pulls and starts.
- `describe` shows `Events` (Scheduled → Pulling → Pulled → Created → Started).
- Bare Pods are disposable and not recreated; a **Deployment** owns pods via a **ReplicaSet** and self-heals.
- Deployment hierarchy: `Deployment → ReplicaSet → Pods`. `pod-template-hash` is added to ReplicaSet/pod names and changes when the pod template changes (basis of rollouts).
- Pods have their own IPs; a **Service** gives a stable virtual IP + DNS name and load-balances over pods matching `selector`.
- `Service.spec.selector` selects **Pods** by label; matching pods appear as `Endpoints`.
- `containerPort` is metadata only; the image decides the real listening port.
- Cluster networking is flat + internal DNS (CoreDNS). Any pod can reach any Service by name; short names work within the same namespace via the pod's `/etc/resolv.conf` search list. `<svc>.<ns>.svc.cluster.local` is the full name.

### M3
- Config is split into **ConfigMap** (non-sensitive) and **Secret** (sensitive). Both are just namespaced objects.
- YAML files are never referenced from inside Kubernetes; objects are referenced by `metadata.name` (`configMapRef.name: app-config`, not the filename).
- Inject all keys with `envFrom: [configMapRef, secretRef]`; pull one key with `env: - valueFrom: configMapKeyRef/secretKeyRef`. Config can also be mounted as files.
- Secret is **base64, not encryption**; real protection is RBAC + etcd encryption-at-rest + external managers (Sealed/External Secrets, Vault).
- Modern K8s no longer auto-creates long-lived SA token Secrets; tokens are short-lived projected volumes.
- Strict decoding: kubectl rejects unknown fields and names the exact path (e.g. `spec.containers[0].envFrom[0].name`), which pinpoints indentation/nesting mistakes.

### M4
- Compose `ports: '6379:6379'` (host publish) becomes a `ClusterIP` Service (internal only); compose `restart` is unnecessary because Deployments always restart pods.
- The Service `metadata.name` becomes the DNS hostname (`redis`), which is why app config is `redis://redis:6379`.
- `kubectl -l <selector>` filters objects by their own labels; Deployment/Service objects need `metadata.labels` to be selectable (pods held the label, so only the pod matched).

### M5
- **StatefulSet** for stateful workloads: stable pod names (`db-0`), stable per-pod storage, ordered rollout. **Deployment** = interchangeable stateless pods.
- Storage chain: Pod → **PVC** (request, "1Gi") → **StorageClass** (kind default `standard`) provisions a **PV**. You write the PVC request, not the PV.
- `volumeClaimTemplates` gives each replica its own PVC; the PVC outlives the pod, so data persists across pod deletion (proved: `proof` row `42` survived `delete pod db-0`).
- **Headless Service** (`clusterIP: None`) gives each pod stable DNS and is referenced by `serviceName`; it does not load-balance.
- `PGDATA` subdirectory avoids `lost+found` init failures on some volume types.

### M6 / M7
- No `depends_on` in Kubernetes: no start ordering. Containers must retry dependencies; readiness probes gate traffic until ready.
- ConfigMap values must be strings; quote numeric-looking values (`"200"`).
- kind nodes use their own containerd store and cannot see local `docker` images — `kind load docker-image` copies them in.
- `imagePullPolicy: IfNotPresent` uses the locally loaded image; `Always`/`:latest` would try a registry and give `ErrImagePull`.
- Service can remap ports (`port: 80` → `targetPort: 3000`); clients use the Service port.
- Prisma `prisma` CLI is a devDependency, absent from the `--prod` image; run schema changes from the host via `kubectl port-forward svc/db` and override `DATABASE_URL`/`DIRECT_URL` (shell env beats `.env`).
- DB initialize with `prisma db push` (learning only; production uses versioned `prisma migrate deploy` to avoid data loss).
- Runtime uses `DATABASE_URL` through PgBouncer (`?pgbouncer=true`); migrations use `DIRECT_URL` straight to Postgres.

### M8
- **readinessProbe** = traffic gate (removed from Endpoints on failure, not restarted). **livenessProbe** = restart on failure. **startupProbe** = pause the others until the app has started once.
- Mechanisms: `httpGet` (success = HTTP 200–399), `tcpSocket`, `exec`.
- Timing: `initialDelaySeconds` (grace), `periodSeconds` (frequency), `timeoutSeconds` (default 1), `failureThreshold` (default 3), `successThreshold` (default 1).
- Readiness gates rolling updates: a never-ready new pod **stalls the rollout** while old pods keep serving (zero-downtime).
- `httpGet` stops at redirects (`ProbeWarning: Probe terminated redirects`); a 3xx still counts as success. Best practice is a dedicated no-auth `/healthz` returning 200.

### M9
- **Ingress = declarative config (a "form"), not a proxy and not a network hop.** A **controller** is the running worker that reads Ingress objects and routes traffic. Kubernetes ships controllers for Pod/Deployment/Service but **not** for Ingress — you install one (`ingress-nginx` here, into namespace `ingress-nginx`).
- Without a controller, Ingress objects are inert (no error, just nothing). Internal pod↔Service traffic works regardless; Ingress is only the external HTTP routing layer.
- Ingress is an API; nginx/Traefik/Caddy are implementations. The Caddy ingress controller would consume the same Ingress objects.
- `ingressClassName` selects the worker; `rules[].backend` points at a **Service** name/port (controller resolves pods).
- kind path: Windows `localhost:8080` → (kind `extraPortMappings` 8080→80) → node port 80 → nginx controller → Service `web:80` → pod `:3000`. We chose host 8080 to avoid admin/port-80 conflicts.
- `hosts` file maps `task.local` → `127.0.0.1`; local DNS, not a network rule.
- ConfigMap changes do **not** restart pods; env is read at container start, so `kubectl rollout restart` is required after a config change. `ORIGIN`/`AUTH_URL` must match the external URL or SvelteKit rejects requests.
- `kubectl describe ingress` shows a `Sync` event and the resolved backend once the controller picks it up.
- TLS needs a `kubernetes.io/tls` Secret; Caddy's auto-HTTPS is replaced by installing **cert-manager**.

### M10
- `kubectl scale deploy/<name> --replicas=N` (imperative); Endpoints update as pods become Ready.
- `kubectl rollout history` lists revisions (one per ReplicaSet); old ReplicaSets kept (`spec.revisionHistoryLimit`, default 10) so `kubectl rollout undo [--to-revision=N]` works.
- A failed new image leaves old pods serving and the rollout stalled — readiness is the safety net; `rollout undo` recovers.
- `CHANGE-CAUSE` is `<none>` unless set via the `kubernetes.io/change-cause` annotation (`--record` is removed in modern kubectl).
- `kubectl logs [--previous]`, `kubectl exec`, `kubectl get events --sort-by=.lastTimestamp` are the debugging trio.
- `kubectl get all` does **not** include Ingress, ConfigMaps, Secrets, or PVCs.
- `localhost` inside a pod ≠ `localhost` on the host; a pod listening on IPv4 `0.0.0.0` may refuse `localhost` if it resolves to IPv6 `::1`.
- `kubectl apply` of the source YAML resyncs a Deployment after an imperative `rollout undo`.

### M11
- **Kustomize** assembles plain YAML (no templates); built into kubectl via `-k`.
- Layout: `base/` + `overlays/<env>/`. The base **cannot** live in a directory that contains an overlay — Kustomize reports a cycle; base and overlays must be siblings.
- `kustomization.yaml` lists `resources`; overlays compose on the base (`resources: [../../base]`).
- Overlay deltas: built-in fields (`replicas`, `images`, `labels`, `namespace`, `commonAnnotations`), patches (strategic-merge file or JSON6902 inline), and extra resources listed under `resources:`.
- Avoid `commonLabels` (rewrites immutable Deployment selectors); use the `labels` field with `includeSelectors: false`.
- `replicas` is declarative desired state; the last applied manifest wins, and the Deployment controller reconciles pod count.
- `kubectl kustomize <dir>` renders; `kubectl apply -k <dir>` applies.

## Useful commands

```powershell
kind create cluster --config deploy/k8s/kind-config.yaml
kubectl config set-context --current --namespace=vlu
kubectl apply -f <file>
kubectl get pods|deploy|rs|svc|endpoints|configmaps|secrets [-o wide|--show-labels]
kubectl describe pod|svc <name>
kubectl logs <pod>
kubectl exec -it <pod> -- sh
kubectl port-forward pod/<pod> 8080:80
kubectl run tmp --rm -it --image=alpine --restart=Never -- sh
kubectl delete pod <name>
```

## File index

Layout (Kustomize): `base/` holds the manifests; `overlays/<env>/` are deltas. Base cannot live in a directory that contains an overlay — Kustomize flags that as a cycle.

| File | Object | Status |
| --- | --- | --- |
| `kind-config.yaml` | kind cluster (host 8080→80, 8443→443) | done |
| `base/00-namespace.yaml` | Namespace `vlu` | done |
| `base/01-pod.yaml` | bare nginx Pod (deleted on purpose) | learning artifact (unused) |
| `base/02-deployment.yaml` | Deployment `hello` | learning artifact (unused) |
| `base/03-service.yaml` | Service `hello` (ClusterIP) | learning artifact (unused) |
| `base/04-configmap.yaml` | ConfigMap `app-config` | learning artifact (unused) |
| `base/05-secret.yaml` | Secret `app-secret` | learning artifact (unused) |
| `base/06-env-demo.yaml` | Pod consuming both | learning artifact (unused) |
| `base/07-redis.yaml` | Deployment + Service `redis` | done |
| `base/08-db-config.yaml` | ConfigMap `db-config` (Postgres) | done |
| `base/09-db-secret.yaml` | Secret `db-secret` (Postgres password) | done |
| `base/10-db.yaml` | Headless Service + StatefulSet `db` | done |
| `base/11-pgbouncer-config.yaml` | ConfigMap `pgbouncer-config` | done |
| `base/12-pgbouncer-secret.yaml` | Secret `pgbouncer-secret` | done |
| `base/13-pgbouncer.yaml` | Deployment + Service `pgbouncer` | done |
| `base/14-web-config.yaml` | ConfigMap `web-config` | done |
| `base/15-web-secret.yaml` | Secret `web-secret` | done |
| `base/16-web.yaml` | Deployment + Service `web` | done |
| `base/17-ingress.yaml` | Ingress for `task.local` | done |
| `base/kustomization.yaml` | aggregates the real stack | done |
| `overlays/kind/kustomization.yaml` | overlay: 2 `web` replicas, `environment: kind` | done |

## Next steps

Roughly in order of value for turning this into a production-grade setup:

1. **Resource requests/limits** on every container. Right now pods are `QoS: BestEffort` (first to be evicted). Add `resources.requests`/`limits` (start with `web`, `db`, `redis`) so the scheduler packs nodes correctly and the cluster can evict fairly.
2. **TLS** — install `cert-manager`, issue a cert for the Ingress host, and reference it via `spec.tls` + a `kubernetes.io/tls` Secret. Replaces Caddy's auto-HTTPS; remove the `:8080` by mapping host 443→8443.
3. **Real secret management** — the current Secrets are base64 plaintext in git. Move to **Sealed Secrets** (safe to commit) or **External Secrets** (Vault / cloud secret store). Never commit real credentials.
4. **Autoscaling** — install `metrics-server`, add a `HorizontalPodAutoscaler` for `web` (and a `PodDisruptionBudget` for availability during node drains).
5. **Migrations as a Job** — replace the manual `prisma db push` port-forward with a `Job` (or initContainer) running `prisma migrate deploy`, so schema changes ship with the app declaratively.
6. **Image pipeline** — push `vlu-app` to a registry (GHCR/ECR) with immutable tags, then drop `kind load` in favor of `imagePullPolicy: Always` + `imagePullSecrets`.
7. **Observability** — `kube-prometheus-stack` for metrics/dashboards, plus a dedicated no-auth `/healthz` endpoint so probes don't hit the auth redirect.
8. **Helm / Gateway API** — compare Kustomize against Helm, and evaluate the Gateway API as the more expressive successor to Ingress.
9. **Real cluster** — deploy the same base to a managed cluster (EKS/GKE/AKS) or the Lightsail box, swapping only the Ingress controller and the storage class.
10. **Startup probe for `web`** — the app is slow to start; a `startupProbe` avoids premature liveness restarts on cold start.

