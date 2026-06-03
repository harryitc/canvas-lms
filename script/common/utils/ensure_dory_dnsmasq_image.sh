#!/bin/bash
source script/common/utils/common.sh

DORY_DNSMASQ_IMAGE=${DORY_DNSMASQ_IMAGE:-freedomben/dory-dnsmasq:1.1.0}
DORY_DNSMASQ_BASE_IMAGE=${DORY_DNSMASQ_BASE_IMAGE:-andyshinn/dnsmasq:2.83}

function build_dory_dnsmasq_image {
  local tmpdir build_status
  tmpdir=$(mktemp -d)

  cat > "$tmpdir/Dockerfile" <<EOF
FROM ${DORY_DNSMASQ_BASE_IMAGE}
RUN printf '%s\n' \
  'listen-address=0.0.0.0' \
  'interface=eth0' \
  'interface=docker0' \
  'address=/docker/127.0.0.1' > /etc/dnsmasq.conf
RUN printf '%s\n' \
  '#!/bin/sh' \
  '' \
  'address=' \
  'while [ "\$#" -ge 2 ]; do' \
  '  address="\${address}address=/\$1/\$2\\n"' \
  '  shift 2' \
  'done' \
  '' \
  'if [ -n "\$address" ]; then' \
  '  sed -i -e "s|^address.*|\${address}|" /etc/dnsmasq.conf' \
  'fi' \
  '' \
  'echo "Starting with configuration:"' \
  'cat /etc/dnsmasq.conf' \
  '' \
  'dnsmasq -k --log-facility=-' > /usr/local/bin/start-with-domain-ip.sh \
  && chmod +x /usr/local/bin/start-with-domain-ip.sh
EXPOSE 53/tcp 53/udp
ENTRYPOINT ["/usr/local/bin/start-with-domain-ip.sh"]
CMD ["docker", "127.0.0.1"]
EOF

  start_spinner "Building local dory dnsmasq image..."
  _canvas_lms_track_with_log docker build -t "$DORY_DNSMASQ_IMAGE" "$tmpdir"
  build_status=$?
  stop_spinner $build_status

  rm -rf "$tmpdir"
  return $build_status
}

function ensure_dory_dnsmasq_image {
  if docker image inspect "$DORY_DNSMASQ_IMAGE" > /dev/null 2>&1; then
    return 0
  fi

  message "Local dory dnsmasq image not found. Building a compatible replacement..."
  build_dory_dnsmasq_image
}