terraform {
  required_providers {
    google = {
        source = "hashicorp/google"
        version = "6.8.0"
    }
  }
}


locals {
  ssh_metadata = {
    ssh-keys = "${var.ssh_user}:${var.ssh_key}"
  }
}

