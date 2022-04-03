# GITHUB ACTIONS RUNNER

## Execution

You can choose between running it directly as a single docker container or using docker-compose to run multiple containers (same VM)

### Single container

```bash
docker run --name github-runner -e RUNNER_NAME_PREFIX="github-runner" -e ACCESS_TOKEN="ghp_ELoqy5RPPk1lZ1BSGGmXXZ7GCebz19sfDD" -e RUNNER_WORKDIR="/tmp/workbench" -e RUNNER_SCOPE="org" -e ORG_NAME="gealium" -e LABELS="my-label,other-label" -v /var/run/docker.sock:/var/run/docker.sock -v /tmp/github-runner-your-repo:/tmp/workbench goatlab/github-runner:0.0.3
```

### Multiple containers

```bash
docker-compose up --scale runner=2 -d
```
