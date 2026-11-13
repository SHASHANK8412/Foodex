# Spark image for the Foodex jobs: the official Apache Spark image plus NumPy,
# which PySpark's MLlib needs on the driver.
FROM apache/spark:3.5.4-scala2.12-java17-python3-ubuntu

USER root
RUN pip3 install --no-cache-dir numpy==1.26.4

ENV PYTHONUNBUFFERED=1
WORKDIR /opt/foodex/analytics
