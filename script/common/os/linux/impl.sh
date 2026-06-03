#!/bin/bash
source script/common/utils/spinner.sh

function set_service_util {
  if installed service; then
    service_manager='service'
    start_docker="sudo service docker start"
  elif installed systemctl; then
    service_manager='systemctl'
    start_docker="sudo systemctl start docker"
  else
    echo "Unable to find 'service' or 'systemctl' installed."
    exit 1
  fi
}

function start_docker_daemon {
  eval "$service_manager docker status &> /dev/null" && return 0
  prompt 'The docker daemon is not running. Start it? [y/n]' confirm
  [[ ${confirm:-n} == 'y' ]] || return 1
  eval "$start_docker"
  sleep 1 # wait for docker daemon to start
}

function setup_docker_as_nonroot {
  docker ps &> /dev/null && return 0
  message 'Setting up docker for nonroot user...'
  if ! id -Gn "$USER" | grep -q '\bdocker\b'; then
    message "Adding $USER user to docker group..."
    confirm_command "sudo usermod -aG docker $USER" || true
  fi
  message 'We need to login again to apply that change.'
  confirm_command "exec sg docker -c $0"
}

function user_gem_bin_path {
  ruby -r rubygems -e 'print "#{Gem.user_dir}/bin"'
}

function ensure_user_gem_bin_in_path {
  installed ruby || return 0

  local gem_bin
  gem_bin="$(user_gem_bin_path)"
  case ":$PATH:" in
    *":$gem_bin:"*) ;;
    *) export PATH="$gem_bin:$PATH" ;;
  esac
}

function install_ruby_and_build_tools {
  if installed ruby && installed gem; then
    return 0
  fi

  if ! installed apt-get; then
    warning_message "Ruby, RubyGems, and build-essential are required to install dory automatically. Please install them manually and rerun this script."
    return 1
  fi

  message 'Installing Ruby, RubyGems, and build tools required for dory...'
  confirm_command 'sudo apt-get update && sudo apt-get install -y ruby-full ruby-dev build-essential'
}

function install_dory_if_missing {
  ensure_user_gem_bin_in_path
  installed dory && return 0

  prompt 'dory is not installed. Install Ruby, build-essential, and dory automatically? [y/n]' install_dory
  [[ ${install_dory:-n} == 'y' ]] || return 0

  install_ruby_and_build_tools || return 1
  ensure_user_gem_bin_in_path

  message 'Installing dory gem for the current user...'
  confirm_command 'gem install --user-install dory' || return 1
  ensure_user_gem_bin_in_path

  if ! installed dory; then
    warning_message "dory was installed but is not on PATH yet. Add $(user_gem_bin_path) to your shell PATH and rerun this script if needed."
    return 1
  fi
}
