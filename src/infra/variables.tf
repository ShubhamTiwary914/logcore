variable "project_id" {
  description = "The ID of the Google Cloud project"
  type        = string
}

variable "region" {
  description = "The region for the Google Cloud resources"
  type        = string
}

variable "zone" {
  description = "The region for the Google Cloud resources"
  type        = string
}

variable "ssh_user" {
  default = "your-username"
}

variable "ssh_key" {
  description = "SSH public key string"
  type        = string
}