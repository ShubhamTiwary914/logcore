## logcore - homelab IOT monitor time series data & resource with grafana & prom 

> Homelab with 3 machines (2 PCs, 1 Raspberry pi) on docker swarm ingress network just loading & monitoring intermediate size batches of time series data 


#### Toolbox:
- **EMQX** (over TCP, not WS):  (MQTT broker)
- **Redis streams**: (streaming)
- **TimescaleDB**: (PG extension for timeseries)
- **Docker Swarm**:  (container manage) -> [specifically v27.5.1]
- **Vagrant** (VM manager) -> [only initially]
- **Node.js** (+ Typescript): (scripting whenever needed)


#### System specifications (homelab):
- (leader) AMD Ryzen 5 7530U, 16 GB mem, 12 CPU cores
- (worker) Intel i3, 8 GB mem, 4 CPU cores
- (worker) Pi 3B+, 1 GB mem, 4 CPU cores


<br />

### Architecture Overview

> Very rough HLD of the homelab, its containers & processes

![system](https://github.com/user-attachments/assets/1ca5bab3-21a0-4c2c-8bea-1141361e8cd5)


<hr>

<br />


### Views (Metrics' Dashboards)

> EMQX broker dashboard 
![screenshot_2025-05-04-203217](https://github.com/user-attachments/assets/04e2833f-4932-4d9f-a8ff-24d748a85fcb)

<br />

> Redis metrics - grafana (direct with redis-data-source)
![screenshot_2025-05-04-204054](https://github.com/user-attachments/assets/62f2ee9c-6c73-486b-b92f-8967fe9130f0)

- Additionally, also used the [redis-benchmark](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/benchmarks/) tool to check iops for different redis operations (mainly used [xadd](https://redis.io/docs/latest/commands/xadd/))
  
<br />

> Timescale metrics - grafana (with PG exporter for prometheus -> prometheus --> grafana)
![screenshot_2025-05-04-204342](https://github.com/user-attachments/assets/468a430b-aa5a-4b2c-bda4-02567523f7d9)

<br />

<hr>

<br />


### Setting up locally


> [!NOTE]
> Prerequisites for setup:
> 1. docker - with compose plugin (v27.5.1 recommended - swarm had issues in other versions)
> 2. git cli / github desktop
> 3. Virtualbox (if no extra PC) + Vagrant


<br />

1. Setup 2 VMs (minimum). Ways you can do this:
  - VirtualBox (recommended) - any linux based OS will do (recommended: debian based)
  - Vagrant (with Virtualbox)
  - have docker setup on each of the VM or "nodes"
> for physical machines, better to setup [static IPs](https://www.freecodecamp.org/news/setting-a-static-ip-in-ubuntu-linux-ip-address-tutorial/) on whatever interface you're using (eth, wlan, etc)

<br />


2. Add machines to docker swarm network.
> On first machine, create a leader node via:
```sh
docker swarm init --advertise-addr <IP>  #IP = get with 'ip addr' or 'ifconfig' (on shared interface between the devices), for vbox, there's the "vbox0" interface
```

> On other machines, join as worker:
```sh
docker swam join --token <join-token> <advertised-IP>  #on leader machine, after init, you'll get a join-token for worker nodes
```


3. Clone project & start the docker stack (in leader machine)
```
git clone https://github.com/ShubhamTiwary914/logcore.git
cd logcore/src
docker stack deploy -c stack-local.yml logcore 
```


4. Run processes (from any machine works)
docker swarm has a mesh load balancer, so any machine can interact with containers from any other machine

> broker-process (consumers for MQTT broker):
```
task broker-main -- <topic>
```

> worker-process (consumer for redis stream):
```
task worker-main -- <topic> 
```

> producers:  (you can do on your own, but there's a script already to simulate this)
```
task producer-main -- <topic>
```

<br />


> [!TIP]
> There's 3 dummy topicd right now: [boiler, logistics, greenhouse]


<br />

#### Use after setup:

The dashboards should be live at:
- http://node-IP:18083  (EMQX dashboard)
- http://node-IP:3000 (grafana dashboard)

> node-IP is IP of any node (context: docker swarm ingress network is in use, so it has a mesh load balancer, any node can interact with any other node's containers, just add the right port)


<br />

#### Next things to add:

- It's tested locally on homelab, but very limited to my wifi's jitter in some cases: will scale more after getting a switch or on GCP
- Limited to 3 topics added earlier, having APIs or Interface for adding more control for more topics or a "one dashboard to rule them all" (from user's POV) maybe?
