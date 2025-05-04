resource "google_compute_firewall" "vm-firewall" {
  name = "vm-firewall"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]  #traffic from anywhere
  target_tags   = ["allow-web-ssh"]
}




resource "google_compute_instance" "gcp-o1" {
    name = "gcp-o1"
    machine_type = "e2-small"
    zone = var.zone

    boot_disk {
      initialize_params {
        image = "ubuntu-os-cloud/ubuntu-2204-lts"  
      }
    }

    network_interface {
      network = google_compute_network.vpc_network.name
      access_config {}
    }

    tags = ["allow-web-ssh"]
    metadata = local.ssh_metadata
}

resource "google_compute_instance" "gcp-o2" {
    name = "gcp-o2"
    machine_type = "e2-small"
    zone = var.zone

    boot_disk {
      initialize_params {
        image = "ubuntu-os-cloud/ubuntu-2204-lts"  
      }
    }

    network_interface {
      network = google_compute_network.vpc_network.name
      access_config {}
    }

    tags = ["allow-web-ssh"]
    metadata = local.ssh_metadata
}
